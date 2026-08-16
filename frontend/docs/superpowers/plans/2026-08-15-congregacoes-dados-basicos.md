# Congregações — Dados Básicos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a congregation's own members view its data (nome, número, cidade) and let Coordenador/Administrador Global edit it, with the change recorded in `historicos`.

**Architecture:** A `numero` column and a `historicos`-writing trigger are added to `public.congregacoes` (RLS already covers this slice — no policy changes needed). The frontend gets a `src/features/congregacoes/use-congregacao.ts` hook (fetch + update) and a new `(app)/congregacao.tsx` screen reachable from a second tab, following the same NativeWind/manual-verification conventions as the Administração auth-core slice.

**Tech Stack:** Supabase (Postgres migration + RLS, already provisioned), `@supabase/supabase-js`, Expo Router (`expo-router/ui` `Tabs`/`TabTrigger` for web, `expo-router/unstable-native-tabs` for native), NativeWind, React state (no new state library), no automated test framework (verification is manual — see each task).

**Spec:** `docs/superpowers/specs/2026-08-15-congregacoes-dados-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*`.
- Supabase project: `imeoyetcbjlkrxubwldv`. Existing RLS policies `congregacoes_select` (open read) and `congregacoes_update` (Administrador Global always; Coordenador only for `id = current_usuario_congregacao_id()`) already cover this slice's authorization — do not add or modify RLS policies on `congregacoes` or `historicos` as part of this plan.
- No new npm dependencies — the Estado/Cidade picker is built with React Native's own `Modal` + `FlatList`.
- Error copy (verbatim, per spec):
  - Número duplicado: `"Esse número já está em uso por outra congregação."`
  - Campos vazios: `"Informe o nome e o número da congregação."`
  - Falha genérica ao salvar: `"Não foi possível salvar as alterações. Tente novamente."`
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, matching `src/app/login.tsx` and `src/app/(app)/index.tsx` (light/dark via `dark:` variants).
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every task before committing.
- The Supabase project is shared/live — Task 1's migration is applied directly via the `apply_migration` MCP tool (no local Supabase stack in this project). Double-check the SQL before applying; there is no staging environment to rehearse against.

---

### Task 1: Database — `numero` column, RN-102 audit trigger, and docs

**Files:**
- Create: `database/migrations/20260815120000_add_numero_to_congregacoes.sql`
- Modify: `docs/04-Regras-de-Negocio.md` (new RN-025)
- Modify: `docs/08-DER.md` (Congregações table)
- Modify: `docs/09-Dicionario-de-Dados.md` (Congregações table)

**Interfaces:**
- Produces: `public.congregacoes.numero` (`varchar`, `not null`, `unique`), consumed by Task 2's `use-congregacao.ts`.
- Produces: trigger `log_congregacao_atualizada` — no application code calls it directly; it fires automatically on `UPDATE public.congregacoes`.

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the `apply_migration` MCP tool (`project_id: imeoyetcbjlkrxubwldv`, `name: add_numero_to_congregacoes`) with this SQL:

```sql
-- Coluna numero: número oficial de registro da congregação (RN-025).
alter table public.congregacoes add column numero varchar;

-- Backfill do único registro existente (congregação "Timirim").
update public.congregacoes set numero = '48991' where nome = 'Timirim';

alter table public.congregacoes alter column numero set not null;
alter table public.congregacoes add constraint congregacoes_numero_key unique (numero);

-- Auditoria (RN-102): registra em historicos quando nome, numero ou
-- cidade_id mudam. security definer, mesmo estilo das funções auxiliares
-- já existentes (current_usuario_congregacao_id, is_administrador_global).
create function public.log_congregacao_atualizada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.historicos (usuario_id, tipo, descricao, dados)
  values (
    auth.uid(), 'congregacao_atualizada', 'Dados da congregação atualizados',
    jsonb_build_object(
      'congregacao_id', new.id,
      'antes', jsonb_build_object('nome', old.nome, 'numero', old.numero, 'cidade_id', old.cidade_id),
      'depois', jsonb_build_object('nome', new.nome, 'numero', new.numero, 'cidade_id', new.cidade_id)
    )
  );
  return new;
end;
$$;

create trigger log_congregacao_atualizada after update on public.congregacoes
  for each row
  when (old.nome is distinct from new.nome or old.numero is distinct from new.numero or old.cidade_id is distinct from new.cidade_id)
  execute function public.log_congregacao_atualizada();
```

Expected: tool reports success. Note the actual applied migration `version` returned by the tool (visible via `list_migrations`) for reference — it does not need to match the local filename exactly (precedent: the existing `20260812130000_replace_prototype_with_der_schema.sql` file's applied version is `20260813015634`).

- [ ] **Step 2: Verify against the live database**

Run (via `execute_sql` MCP tool, `project_id: imeoyetcbjlkrxubwldv`):

```sql
select id, numero, nome from public.congregacoes;
```

Expected: one row, `numero = '48991'`, `nome = 'Timirim'`.

- [ ] **Step 3: Save the migration as a local file**

Create `database/migrations/20260815120000_add_numero_to_congregacoes.sql` with the exact SQL from Step 1, plus a short header comment (mirroring the style of the existing migration file):

```sql
-- ============================================================================
-- SIPD — Migração: número oficial da congregação + auditoria (RN-025, RN-102)
-- ============================================================================
--
-- Contexto:
-- UC-CGR-002 (docs/06.1.2 - Congregações.md) exige que o usuário possa
-- corrigir o número oficial da congregação, mas a tabela congregacoes não
-- tinha essa coluna (docs/08-DER.md v1.2). Esta migração adiciona `numero`
-- (obrigatório, único) e um trigger de auditoria para RN-102, que ainda não
-- tinha nenhuma implementação além do trigger genérico de atualizado_em.
--
-- Fontes: docs/superpowers/specs/2026-08-15-congregacoes-dados-design.md
-- ============================================================================

<same SQL as Step 1>
```

- [ ] **Step 4: Update `docs/04-Regras-de-Negocio.md` — new RN-025**

Find the "Congregações" section (RN-020 to RN-024). After RN-024's block (before the `# Oradores` heading), insert:

```markdown
### RN-025

Toda congregação deverá possuir um número oficial, único entre as congregações.

---
```

- [ ] **Step 5: Update `docs/08-DER.md` — Congregações table**

In section "## 3. Congregações", change the table to:

```markdown
| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| cidade_id | UUID | FK → cidades |
| nome | VARCHAR | Nome da congregação |
| numero | VARCHAR | Número oficial de registro, único |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |
```

Add, right after the table (before "### Relacionamentos"):

```markdown
### Restrições

- `numero` deverá ser único (RN-025).
```

Bump the version line at the top of the file (`**Versão:** 1.2` → `1.3`).

- [ ] **Step 6: Update `docs/09-Dicionario-de-Dados.md` — Congregações table**

In section "## 3. Congregações", change the table to:

```markdown
| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador único da congregação |
| cidade_id | UUID | Sim | Não | Sim | Não | Cidade onde a congregação está localizada |
| nome | VARCHAR | Sim | Não | Não | Não | Nome da congregação |
| numero | VARCHAR | Sim | Não | Não | Sim | Número oficial de registro da congregação (RN-025) |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da congregação |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |
```

- [ ] **Step 7: Commit**

```bash
git add database/migrations/20260815120000_add_numero_to_congregacoes.sql docs/04-Regras-de-Negocio.md docs/08-DER.md docs/09-Dicionario-de-Dados.md
git commit -m "feat(congregacoes): add numero column and RN-102 audit trigger"
```

---

### Task 2: `useCongregacao` hook

**Files:**
- Create: `frontend/src/features/congregacoes/use-congregacao.ts`

**Interfaces:**
- Consumes: `useAuth()` from `@/features/administracao/use-auth` (for `usuario.congregacao_id`); `supabase` from `@/lib/supabase`.
- Produces (used by Task 3 and Task 4):
  - `type Cidade = { id: string; nome: string; estado_id: string }`
  - `type Congregacao = { id: string; numero: string; nome: string; cidade_id: string; cidade: Cidade }`
  - `type CongregacaoStatus = 'loading' | 'ready' | 'error'`
  - `useCongregacao(): { status: CongregacaoStatus; congregacao: Congregacao | null; atualizar: (input: { nome: string; numero: string; cidade_id: string }) => Promise<{ error: string | null }> }`

- [ ] **Step 1: Create the directory and write `use-congregacao.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Cidade = {
  id: string;
  nome: string;
  estado_id: string;
};

export type Congregacao = {
  id: string;
  numero: string;
  nome: string;
  cidade_id: string;
  cidade: Cidade;
};

export type CongregacaoStatus = 'loading' | 'ready' | 'error';

type AtualizarInput = {
  nome: string;
  numero: string;
  cidade_id: string;
};

const CONGREGACAO_SELECT = 'id, numero, nome, cidade_id, cidade:cidades(id, nome, estado_id)';
const UNIQUE_VIOLATION = '23505';
const ERRO_NUMERO_DUPLICADO = 'Esse número já está em uso por outra congregação.';
const ERRO_SALVAR = 'Não foi possível salvar as alterações. Tente novamente.';

export function useCongregacao() {
  const { usuario } = useAuth();
  const [congregacao, setCongregacao] = useState<Congregacao | null>(null);
  const [status, setStatus] = useState<CongregacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('congregacoes')
      .select(CONGREGACAO_SELECT)
      .eq('id', usuario.congregacao_id)
      .single();

    if (error || !data) {
      setStatus('error');
      return;
    }

    setCongregacao(data as unknown as Congregacao);
    setStatus('ready');
  }, [usuario]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(input: AtualizarInput): Promise<{ error: string | null }> {
    if (!congregacao) return { error: ERRO_SALVAR };

    const { data, error } = await supabase
      .from('congregacoes')
      .update(input)
      .eq('id', congregacao.id)
      .select(CONGREGACAO_SELECT)
      .single();

    if (error) {
      return { error: error.code === UNIQUE_VIOLATION ? ERRO_NUMERO_DUPLICADO : ERRO_SALVAR };
    }
    if (!data) {
      return { error: ERRO_SALVAR };
    }

    setCongregacao(data as unknown as Congregacao);
    return { error: null };
  }

  return { status, congregacao, atualizar };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. This file isn't imported anywhere yet, so this only validates its own internal types.

- [ ] **Step 3: Commit**

```bash
git add src/features/congregacoes/use-congregacao.ts
git commit -m "feat(congregacoes): add useCongregacao hook"
```

---

### Task 3: Congregação screen (read-only) and new tab

**Files:**
- Create: `frontend/src/app/(app)/congregacao.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: `useCongregacao` from Task 2.
- Produces: no new exports — Task 4 keeps modifying this same screen file.

- [ ] **Step 1: Create `congregacao.tsx` (read-only view)**

```tsx
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCongregacao } from '@/features/congregacoes/use-congregacao';

export default function CongregacaoScreen() {
  const { status, congregacao } = useCongregacao();

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !congregacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os dados da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Congregação</Text>

        <View className="mt-4 gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Nome</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{congregacao.nome}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Número</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{congregacao.numero}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{congregacao.cidade.nome}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Add the native tab**

In `frontend/src/components/app-tabs.tsx`, add a second `NativeTabs.Trigger` after the `index` one:

```tsx
<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
<NativeTabs.Trigger name="congregacao">
  <NativeTabs.Trigger.Label>Congregação</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

- [ ] **Step 3: Add the web tab**

In `frontend/src/components/app-tabs.web.tsx`, add a second `TabTrigger` after the `home` one, inside `CustomTabList`:

```tsx
<TabTrigger name="home" href="/" asChild>
  <TabButton>Home</TabButton>
</TabTrigger>
<TabTrigger name="congregacao" href="/congregacao" asChild>
  <TabButton>Congregação</TabButton>
</TabTrigger>
```

- [ ] **Step 4: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run (from `frontend/`): `npm run web`, log in with any user.

1. Confirm a "Congregação" tab appears next to "Home".
2. Tap it → confirm nome/número/cidade are displayed and match the database (`Timirim` / `48991` / its cidade).

Stop and fix before proceeding if this doesn't hold.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/congregacao.tsx" src/components/app-tabs.tsx src/components/app-tabs.web.tsx
git commit -m "feat(congregacoes): add read-only Congregação screen and tab"
```

---

### Task 4: Edit mode — form, Estado/Cidade seletor, save

**Files:**
- Modify: `frontend/src/app/(app)/congregacao.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` (for `usuario.perfil.nome`), `useCongregacao()` (`atualizar`), `supabase` (direct `estados`/`cidades` queries for the picker).
- Produces: nothing new for later tasks — this is the last screen change in this slice.

- [ ] **Step 1: Rewrite `congregacao.tsx` with edit mode**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { useCongregacao } from '@/features/congregacoes/use-congregacao';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };
type SeletorItem = { id: string; label: string };

const PODE_EDITAR = ['Coordenador', 'Administrador Global'];

function SeletorModal({
  visivel,
  titulo,
  itens,
  onSelecionar,
  onFechar,
}: {
  visivel: boolean;
  titulo: string;
  itens: SeletorItem[];
  onSelecionar: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
        <View className="flex-row items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">{titulo}</Text>
          <Pressable onPress={onFechar}>
            <Text className="text-base text-neutral-500 dark:text-neutral-400">Fechar</Text>
          </Pressable>
        </View>
        <FlatList
          data={itens}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelecionar(item.id)}
              className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <Text className="text-base text-neutral-900 dark:text-white">{item.label}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function CongregacaoScreen() {
  const { usuario } = useAuth();
  const { status, congregacao, atualizar } = useCongregacao();

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [estadoLabel, setEstadoLabel] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [cidadeLabel, setCidadeLabel] = useState('');

  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);
  const [seletorAberto, setSeletorAberto] = useState<'estado' | 'cidade' | null>(null);

  const podeEditar = usuario ? PODE_EDITAR.includes(usuario.perfil.nome) : false;

  function iniciarEdicao() {
    if (!congregacao) return;
    setNome(congregacao.nome);
    setNumero(congregacao.numero);
    setEstadoId(congregacao.cidade.estado_id);
    setCidadeId(congregacao.cidade_id);
    setCidadeLabel(congregacao.cidade.nome);
    setErro(null);
    setEditando(true);
  }

  useEffect(() => {
    if (!editando) return;
    supabase
      .from('estados')
      .select('id, nome, uf')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        const lista = (data ?? []) as Estado[];
        setEstados(lista);
        const atual = lista.find((e) => e.id === estadoId);
        if (atual) setEstadoLabel(`${atual.nome} (${atual.uf})`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  useEffect(() => {
    if (!editando || !estadoId) return;
    supabase
      .from('cidades')
      .select('id, nome')
      .eq('estado_id', estadoId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setCidades((data ?? []) as CidadeOpcao[]));
  }, [editando, estadoId]);

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !numero.trim()) {
      setErro('Informe o nome e o número da congregação.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizar({ nome: nome.trim(), numero: numero.trim(), cidade_id: cidadeId });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }

    setEditando(false);
  }

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !congregacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os dados da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Congregação</Text>

        {!editando ? (
          <>
            <View className="mt-4 gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Nome</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.nome}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Número</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.numero}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.cidade.nome}</Text>
              </View>
            </View>

            {podeEditar ? (
              <Pressable
                onPress={iniciarEdicao}
                className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={numero}
              onChangeText={setNumero}
              placeholder="Número"
              keyboardType="numeric"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <Pressable
              onPress={() => setSeletorAberto('estado')}
              className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-neutral-900 dark:text-white">{estadoLabel || 'Selecionar Estado'}</Text>
            </Pressable>
            <Pressable
              onPress={() => estadoId && setSeletorAberto('cidade')}
              className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-neutral-900 dark:text-white">{cidadeLabel || 'Selecionar Cidade'}</Text>
            </Pressable>

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => setEditando(false)}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSalvar}
                disabled={salvando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {salvando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <SeletorModal
        visivel={seletorAberto === 'estado'}
        titulo="Selecionar Estado"
        itens={estados.map((e) => ({ id: e.id, label: `${e.nome} (${e.uf})` }))}
        onSelecionar={(id) => {
          const escolhido = estados.find((e) => e.id === id);
          setEstadoId(id);
          setEstadoLabel(escolhido ? `${escolhido.nome} (${escolhido.uf})` : '');
          setCidadeId('');
          setCidadeLabel('');
          setCidades([]);
          setSeletorAberto(null);
        }}
        onFechar={() => setSeletorAberto(null)}
      />
      <SeletorModal
        visivel={seletorAberto === 'cidade'}
        titulo="Selecionar Cidade"
        itens={cidades.map((c) => ({ id: c.id, label: c.nome }))}
        onSelecionar={(id) => {
          const escolhida = cidades.find((c) => c.id === id);
          setCidadeId(id);
          setCidadeLabel(escolhida?.nome ?? '');
          setSeletorAberto(null);
        }}
        onFechar={() => setSeletorAberto(null)}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification — read-only Perfis**

Run (from `frontend/`): `npm run web` (if not still running).

1. Log in with a Leitor or Editor account (if none exists yet, skip this specific check and note it — Fatia 1 doesn't add user management, so only the bootstrap Administrador Global account may exist).
2. Confirm no "Editar" button appears for those Perfis.

- [ ] **Step 4: Manual verification — edit flow (Coordenador / Administrador Global)**

1. Log in with the Administrador Global account.
2. Go to the Congregação tab → tap "Editar".
3. Confirm the form pre-fills with the current nome/número/cidade.
4. Change the nome and número, pick a different cidade via the Estado → Cidade selectors → "Salvar".
5. Confirm the read-only view now shows the updated values.
6. Reload the page (F5) → confirm the updated values persisted (came from the database, not local-only state).

- [ ] **Step 5: Manual verification — validation and duplicate error**

1. "Editar" → clear the nome or número field → "Salvar" → confirm the message `"Informe o nome e o número da congregação."` appears and nothing is sent to the server.
2. To test the duplicate-número error without a second real congregação, use the `execute_sql` MCP tool to temporarily insert a throwaway row with a known `numero` (e.g. `'99999'`) into `congregacoes` (needs a valid `cidade_id` — reuse the existing one), then try saving the real congregação with that same número → confirm the message `"Esse número já está em uso por outra congregação."` appears. Delete the throwaway row afterward via `execute_sql`.

- [ ] **Step 6: Confirm the history entry**

Run (via `execute_sql` MCP tool):

```sql
select tipo, descricao, dados, criado_em
from public.historicos
where tipo = 'congregacao_atualizada'
order by criado_em desc
limit 5;
```

Expected: one row per successful save from Step 4, with `dados.antes`/`dados.depois` reflecting the actual old/new values.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/congregacao.tsx"
git commit -m "feat(congregacoes): add edit mode with Estado/Cidade seletor"
```

---

### Task 5: End-to-end verification pass

No code changes expected unless a check below fails. Confirms the full slice matches the spec's verification plan before considering the feature done.

**Files:** none (verification only; fix forward in the relevant task's files if something fails).

- [ ] **Step 1: Full typecheck and Expo config check**

Run (from `frontend/`):
```bash
npx tsc --noEmit
npx expo-doctor
```
Expected: typecheck clean. `expo-doctor` may still report the pre-existing patch-version drift noted at the end of the Administração slice (unrelated to this feature) — that's acceptable; no new failures should appear.

- [ ] **Step 2: Re-run the full manual verification from Task 3 and Task 4**

Run (from `frontend/`): `npm run web`. Repeat, in order: Task 3 Step 5 (tab + read-only data), Task 4 Steps 3-6 (edit flow, validation, duplicate error, history entry).

- [ ] **Step 3: Confirm the web bundle still exports cleanly**

Run (from `frontend/`): `npx expo export -p web --output-dir ../temp-sipd-verify-export`, then delete the output directory afterward (`rm -rf ../temp-sipd-verify-export`).
Expected: export completes with no errors; `/congregacao` appears in the exported static routes.

- [ ] **Step 4: Record the outcome**

If every check passed with no code changes needed, no commit is required — the feature is done as of Task 4's commit. If a fix was needed, commit it against the task whose file it belongs to, e.g.:

```bash
git add <fixed files>
git commit -m "fix(congregacoes): <what was actually wrong>"
```
