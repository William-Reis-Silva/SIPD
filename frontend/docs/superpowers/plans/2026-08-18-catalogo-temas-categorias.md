# Catálogo de Temas e Categorias (UC-CAT-001 a 006) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any authenticated user consult Temas and Categorias (the global speech-topic catalog), and let the Administrador Global cadastrar/editar/ativar/desativar both — all through direct PostgREST table access under RLS, no RPCs.

**Architecture:** `categorias`/`temas` already exist in the schema (`database/migrations/20260812130000_replace_prototype_with_der_schema.sql`). This slice adds the missing `categorias_nome_key` unique constraint and revises RLS on both tables: hide `ativo = false` rows from non-Administrador-Global (currently `using (true)` — everyone sees everything), and split the existing `for all` write policy (which implicitly allowed `DELETE`) into `insert`/`update`-only policies restricted to `is_administrador_global()`. Two new hooks (`use-categorias.ts`, `use-temas.ts`) follow the exact query/mutation/historico pattern already used by `use-usuarios-congregacao.ts`. One new screen (`catalogo.tsx`) with an internal Temas/Categorias toggle, reusing the `Dropdown` + `useTheme()` pattern from `usuarios.tsx`, plus a new "Catálogo" tab in both tab bars.

**Tech Stack:** Supabase (Postgres migration + RLS, already provisioned), `@supabase/supabase-js`, Expo Router, NativeWind, `react-native-element-dropdown` (already a dependency), no automated test framework (verification is manual).

**Spec:** `frontend/docs/superpowers/specs/2026-08-18-catalogo-temas-categorias-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*`.
- Supabase project: `imeoyetcbjlkrxubwldv`. The migration is applied directly to this **live** project via the `apply_migration` MCP tool — there is no local Supabase stack and no staging environment. Double-check SQL before applying.
- No new npm dependencies.
- **No RPCs.** All 6 UCs in this slice use direct table access (`12-API.md`) — the only access rule is "todos leem, só Administrador Global escreve", which RLS resolves alone. Do not introduce a `security definer` function for this slice.
- `categorias`/`temas` already exist — this migration **alters** them (constraint + RLS revision), it does not `create table`.
- Error copy (verbatim, per spec):
  - Número de tema duplicado: `"Já existe um tema com esse número."`
  - Nome de categoria duplicado: `"Já existe uma categoria com esse nome."`
  - Falha genérica ao salvar: `"Não foi possível salvar. Tente novamente."`
  - Falha ao carregar: `"Não foi possível carregar o catálogo."`
- Histórico é registrado só em edição (UC-CAT-004/006), não em criação (UC-CAT-003/005) — reflete a Matriz de Rastreabilidade de `06.1.4` (RN-102 só aparece nos UCs de Editar).
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, matching `src/app/(app)/usuarios.tsx`. Reuse `useTheme()` (`@/hooks/use-theme`) for `Dropdown` colors. Ativo/Inativo is a toggle button (`Pressable` + `Text`, "Ativar"/"Desativar"), not a native `Switch` component — `usuarios.tsx` has no `Switch` precedent in this codebase, stay consistent with its button-toggle pattern.
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every frontend task before committing.
- `AGENTS.md` in `frontend/` warns that Expo has changed recently — if a step involving `Stack`/`Tabs`/`NativeTabs` behaves unexpectedly, check `https://docs.expo.dev/versions/v57.0.0/` before improvising a workaround.

---

### Task 1: Database — `categorias_nome_key` constraint, RLS revision

**Files:**
- Create: `database/migrations/20260818220000_catalogo_temas_categorias.sql`
- Modify: `docs/09-Dicionario-de-Dados.md` (Categorias section — mark `nome` unique, add Restrições)

**Interfaces:**
- Produces:
  - Constraint `categorias_nome_key` unique on `categorias.nome`.
  - RLS policies `categorias_select`/`temas_select`: `using (ativo = true or is_administrador_global())` (replaces the old `using (true)`).
  - RLS policies `categorias_manage_insert`/`categorias_manage_update`/`temas_manage_insert`/`temas_manage_update`: replace the old `categorias_write`/`temas_write` (`for all`) — no DELETE policy exists after this migration.
  - Postgrest error code `23505` on `categorias.nome`/`temas.numero` unique violation, matched by Task 2/3's hooks via `error.code === '23505'`.

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the `apply_migration` MCP tool (`project_id: imeoyetcbjlkrxubwldv`, `name: catalogo_temas_categorias`) with this SQL:

```sql
-- ----------------------------------------------------------------------------
-- 1. Constraint que faltava em categorias.nome
-- ----------------------------------------------------------------------------
alter table public.categorias
  add constraint categorias_nome_key unique (nome);

-- ----------------------------------------------------------------------------
-- 2. Revisão de RLS — categorias/temas já existiam com policies mais
-- permissivas (select using(true): todos viam inativos; write for all:
-- Administrador Global podia fazer DELETE, contrariando a convenção de
-- nunca fazer hard delete usada no resto do schema).
-- ----------------------------------------------------------------------------
drop policy categorias_select on public.categorias;
drop policy categorias_write on public.categorias;
drop policy temas_select on public.temas;
drop policy temas_write on public.temas;

create policy categorias_select on public.categorias
  for select to authenticated
  using (ativo = true or public.is_administrador_global());

create policy categorias_manage_insert on public.categorias
  for insert to authenticated
  with check (public.is_administrador_global());

create policy categorias_manage_update on public.categorias
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());

create policy temas_select on public.temas
  for select to authenticated
  using (ativo = true or public.is_administrador_global());

create policy temas_manage_insert on public.temas
  for insert to authenticated
  with check (public.is_administrador_global());

create policy temas_manage_update on public.temas
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());
```

Expected: tool reports success.

- [ ] **Step 2: Verify the new objects exist**

Run (via `execute_sql` MCP tool, `project_id: imeoyetcbjlkrxubwldv`):

```sql
select conname from pg_constraint where conname = 'categorias_nome_key';

select policyname, cmd from pg_policies
where tablename in ('categorias', 'temas')
order by tablename, policyname;
```

Expected:
- First query: one row (`categorias_nome_key`).
- Second query: six rows total — `categorias_manage_insert` (INSERT), `categorias_manage_update` (UPDATE), `categorias_select` (SELECT), `temas_manage_insert` (INSERT), `temas_manage_update` (UPDATE), `temas_select` (SELECT). No `categorias_write`/`temas_write`, no DELETE policy anywhere.

- [ ] **Step 3: Save the migration as a local file**

Create `database/migrations/20260818220000_catalogo_temas_categorias.sql` with a header comment (mirroring existing migration files) followed by the exact SQL from Step 1:

```sql
-- ============================================================================
-- SIPD — Migração: Catálogo de Temas e Categorias (UC-CAT-001 a 006)
-- ============================================================================
--
-- Contexto:
-- categorias/temas já existiam (20260812130000_replace_prototype_with_der_schema.sql)
-- com RLS mais permissiva do que este slice quer: select using(true)
-- (todo authenticated via inativos) e write for all (Administrador Global
-- podia fazer DELETE, contrariando a convenção de nunca fazer hard delete
-- usada no resto do schema). Esta migração fecha essa lacuna e adiciona a
-- constraint de unicidade de categorias.nome que faltava (DER não marcava
-- isso, mas a FA-01 de UC-CAT-005 exige a checagem de duplicidade).
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-18-catalogo-temas-categorias-design.md
-- ============================================================================

<same SQL as Step 1>
```

- [ ] **Step 4: Update `docs/09-Dicionario-de-Dados.md` — Categorias**

Find:

```markdown
| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da categoria |
| nome | VARCHAR | Sim | Não | Não | Não definido no DER | Nome da categoria |
| descricao | TEXT | Não | Não | Não | Não | Descrição da categoria |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da categoria |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

---
```

Replace with:

```markdown
| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da categoria |
| nome | VARCHAR | Sim | Não | Não | Sim | Nome da categoria |
| descricao | TEXT | Não | Não | Não | Não | Descrição da categoria |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da categoria |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Restrições

- `nome` deverá ser único.

---
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/20260818220000_catalogo_temas_categorias.sql docs/09-Dicionario-de-Dados.md
git commit -m "feat(catalogo): add categorias_nome_key constraint and revise temas/categorias RLS"
```

---

### Task 2: `use-categorias.ts` hook

**Files:**
- Create: `frontend/src/features/catalogo/use-categorias.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`, `useAuth()` from `@/features/administracao/use-auth` (only to know when a session exists — no congregação scoping, catálogo is global).
- Produces (used by Task 4):
  ```ts
  export type Categoria = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
  };
  export type CategoriasStatus = 'loading' | 'ready' | 'error';
  function useCategorias(): {
    status: CategoriasStatus;
    categorias: Categoria[];
    criarCategoria: (nome: string, descricao: string) => Promise<{ error: string | null }>;
    editarCategoria: (
      categoria: Categoria,
      dados: { nome: string; descricao: string; ativo: boolean }
    ) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/catalogo/use-categorias.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type CategoriasStatus = 'loading' | 'ready' | 'error';

const CATEGORIAS_SELECT = 'id, nome, descricao, ativo';
const ERRO_NOME_DUPLICADO = 'Já existe uma categoria com esse nome.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useCategorias() {
  const { usuario } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [status, setStatus] = useState<CategoriasStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('categorias')
      .select(CATEGORIAS_SELECT)
      .order('nome');

    if (error) {
      setStatus('error');
      return;
    }

    setCategorias((data ?? []) as Categoria[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarCategoria(nome: string, descricao: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('categorias').insert({ nome, descricao: descricao || null });

    if (error) {
      if (error.code === '23505') return { error: ERRO_NOME_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarCategoria(
    categoria: Categoria,
    dados: { nome: string; descricao: string; ativo: boolean }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('categorias')
      .update({ nome: dados.nome, descricao: dados.descricao || null, ativo: dados.ativo })
      .eq('id', categoria.id);

    if (error) {
      if (error.code === '23505') return { error: ERRO_NOME_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'categoria_editada',
      descricao: 'Categoria editada',
      dados: {
        categoria_id: categoria.id,
        nome_anterior: categoria.nome,
        nome_novo: dados.nome,
        ativo_anterior: categoria.ativo,
        ativo_novo: dados.ativo,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, categorias, criarCategoria, editarCategoria };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/catalogo/use-categorias.ts
git commit -m "feat(catalogo): add use-categorias hook"
```

---

### Task 3: `use-temas.ts` hook

**Files:**
- Create: `frontend/src/features/catalogo/use-temas.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`, `useAuth()` from `@/features/administracao/use-auth`.
- Produces (used by Task 4):
  ```ts
  export type Tema = {
    id: string;
    numero: string;
    titulo: string;
    ativo: boolean;
    categoria_id: string;
    categoria: { id: string; nome: string };
  };
  export type TemasStatus = 'loading' | 'ready' | 'error';
  function useTemas(): {
    status: TemasStatus;
    temas: Tema[];
    criarTema: (numero: string, titulo: string, categoriaId: string) => Promise<{ error: string | null }>;
    editarTema: (
      tema: Tema,
      dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }
    ) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/catalogo/use-temas.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Tema = {
  id: string;
  numero: string;
  titulo: string;
  ativo: boolean;
  categoria_id: string;
  categoria: { id: string; nome: string };
};

export type TemasStatus = 'loading' | 'ready' | 'error';

const TEMAS_SELECT = 'id, numero, titulo, ativo, categoria_id, categoria:categorias(id, nome)';
const ERRO_NUMERO_DUPLICADO = 'Já existe um tema com esse número.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useTemas() {
  const { usuario } = useAuth();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [status, setStatus] = useState<TemasStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase.from('temas').select(TEMAS_SELECT).order('numero');

    if (error) {
      setStatus('error');
      return;
    }

    setTemas((data ?? []) as unknown as Tema[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarTema(numero: string, titulo: string, categoriaId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas')
      .insert({ numero, titulo, categoria_id: categoriaId });

    if (error) {
      if (error.code === '23505') return { error: ERRO_NUMERO_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarTema(
    tema: Tema,
    dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas')
      .update({
        numero: dados.numero,
        titulo: dados.titulo,
        categoria_id: dados.categoriaId,
        ativo: dados.ativo,
      })
      .eq('id', tema.id);

    if (error) {
      if (error.code === '23505') return { error: ERRO_NUMERO_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_editado',
      descricao: 'Tema editado',
      dados: {
        tema_id: tema.id,
        numero_anterior: tema.numero,
        numero_novo: dados.numero,
        categoria_anterior_id: tema.categoria_id,
        categoria_nova_id: dados.categoriaId,
        ativo_anterior: tema.ativo,
        ativo_novo: dados.ativo,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, temas, criarTema, editarTema };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/catalogo/use-temas.ts
git commit -m "feat(catalogo): add use-temas hook"
```

---

### Task 4: `catalogo.tsx` screen and tab entry

**Files:**
- Create: `frontend/src/app/(app)/catalogo.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: `useCategorias` (Task 2), `useTemas` (Task 3), `useAuth()`, `useTheme()`.

- [ ] **Step 1: Create `frontend/src/app/(app)/catalogo.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useCategorias, type Categoria } from '@/features/catalogo/use-categorias';
import { useTemas, type Tema } from '@/features/catalogo/use-temas';

const ERRO_CAMPOS_TEMA = 'Preencha número, título e categoria.';
const ERRO_CAMPOS_CATEGORIA = 'Preencha o nome da categoria.';

type Aba = 'temas' | 'categorias';

export default function CatalogoScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status: statusCategorias, categorias, criarCategoria, editarCategoria } = useCategorias();
  const { status: statusTemas, temas, criarTema, editarTema } = useTemas();

  const [aba, setAba] = useState<Aba>('temas');
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  const [editandoTemaId, setEditandoTemaId] = useState<string | null>(null);
  const [novoTemaNumero, setNovoTemaNumero] = useState('');
  const [novoTemaTitulo, setNovoTemaTitulo] = useState('');
  const [novoTemaCategoriaId, setNovoTemaCategoriaId] = useState('');
  const [mostrarNovoTema, setMostrarNovoTema] = useState(false);
  const [erroTema, setErroTema] = useState<string | null>(null);
  const [salvandoTema, setSalvandoTema] = useState(false);

  const [editandoCategoriaId, setEditandoCategoriaId] = useState<string | null>(null);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [novaCategoriaDescricao, setNovaCategoriaDescricao] = useState('');
  const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false);
  const [erroCategoria, setErroCategoria] = useState<string | null>(null);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temasFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return temas.filter((t) => {
      if (categoriaFiltro && t.categoria_id !== categoriaFiltro) return false;
      if (!buscaNormalizada) return true;
      return (
        t.numero.toLowerCase().includes(buscaNormalizada) ||
        t.titulo.toLowerCase().includes(buscaNormalizada)
      );
    });
  }, [temas, busca, categoriaFiltro]);

  function handleVerTemasDaCategoria(categoriaId: string) {
    setCategoriaFiltro(categoriaId);
    setAba('temas');
  }

  async function handleCriarTema() {
    setErroTema(null);
    if (!novoTemaNumero.trim() || !novoTemaTitulo.trim() || !novoTemaCategoriaId) {
      setErroTema(ERRO_CAMPOS_TEMA);
      return;
    }

    setSalvandoTema(true);
    const { error } = await criarTema(novoTemaNumero.trim(), novoTemaTitulo.trim(), novoTemaCategoriaId);
    setSalvandoTema(false);

    if (error) {
      setErroTema(error);
      return;
    }

    setNovoTemaNumero('');
    setNovoTemaTitulo('');
    setNovoTemaCategoriaId('');
    setMostrarNovoTema(false);
  }

  async function handleEditarTema(tema: Tema, dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }) {
    setErroTema(null);
    setSalvandoTema(true);
    const { error } = await editarTema(tema, dados);
    setSalvandoTema(false);
    setEditandoTemaId(null);
    if (error) setErroTema(error);
  }

  async function handleCriarCategoria() {
    setErroCategoria(null);
    if (!novaCategoriaNome.trim()) {
      setErroCategoria(ERRO_CAMPOS_CATEGORIA);
      return;
    }

    setSalvandoCategoria(true);
    const { error } = await criarCategoria(novaCategoriaNome.trim(), novaCategoriaDescricao.trim());
    setSalvandoCategoria(false);

    if (error) {
      setErroCategoria(error);
      return;
    }

    setNovaCategoriaNome('');
    setNovaCategoriaDescricao('');
    setMostrarNovaCategoria(false);
  }

  async function handleEditarCategoria(categoria: Categoria, dados: { nome: string; descricao: string; ativo: boolean }) {
    setErroCategoria(null);
    setSalvandoCategoria(true);
    const { error } = await editarCategoria(categoria, dados);
    setSalvandoCategoria(false);
    setEditandoCategoriaId(null);
    if (error) setErroCategoria(error);
  }

  const carregando = statusCategorias === 'loading' || statusTemas === 'loading';
  const comErro = statusCategorias === 'error' || statusTemas === 'error';

  if (carregando) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (comErro) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar o catálogo.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Catálogo</Text>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setAba('temas')}
            className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'temas' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Temas</Text>
          </Pressable>
          <Pressable
            onPress={() => setAba('categorias')}
            className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'categorias' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Categorias</Text>
          </Pressable>
        </View>

        {aba === 'temas' ? (
          <>
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por número ou título"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />

            {categoriaFiltro ? (
              <Pressable onPress={() => setCategoriaFiltro(null)} className="items-start">
                <Text className="text-sm text-neutral-500 underline dark:text-neutral-400">
                  Filtrando por categoria · limpar filtro
                </Text>
              </Pressable>
            ) : null}

            {erroTema ? <Text className="text-sm text-red-600 dark:text-red-400">{erroTema}</Text> : null}

            {temasFiltrados.map((t) => (
              <View key={t.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-base font-medium text-neutral-900 dark:text-white">
                  {t.numero}. {t.titulo}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t.categoria.nome}
                  {ehAdministradorGlobal && !t.ativo ? ' · Inativo' : ''}
                </Text>

                {ehAdministradorGlobal ? (
                  editandoTemaId === t.id ? (
                    <EditarTemaForm
                      tema={t}
                      categorias={categorias}
                      colors={colors}
                      dropdownStyle={dropdownStyle}
                      salvando={salvandoTema}
                      onSalvar={(dados) => handleEditarTema(t, dados)}
                      onCancelar={() => setEditandoTemaId(null)}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setEditandoTemaId(t.id)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))}

            {ehAdministradorGlobal ? (
              mostrarNovoTema ? (
                <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <TextInput
                    value={novoTemaNumero}
                    onChangeText={setNovoTemaNumero}
                    placeholder="Número"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <TextInput
                    value={novoTemaTitulo}
                    onChangeText={setNovoTemaTitulo}
                    placeholder="Título"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <Dropdown
                    style={dropdownStyle}
                    containerStyle={{ backgroundColor: colors.background }}
                    placeholderStyle={{ color: colors.textSecondary }}
                    selectedTextStyle={{ color: colors.text }}
                    itemTextStyle={{ color: colors.text }}
                    activeColor={colors.backgroundSelected}
                    data={categorias.map((c) => ({ id: c.id, label: c.nome }))}
                    labelField="label"
                    valueField="id"
                    value={novoTemaCategoriaId}
                    placeholder="Selecionar categoria"
                    onChange={(item) => setNovoTemaCategoriaId(item.id)}
                  />
                  <Pressable
                    onPress={handleCriarTema}
                    disabled={salvandoTema}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {salvandoTema ? <ActivityIndicator /> : (
                      <Text className="font-medium text-white dark:text-neutral-900">Salvar Tema</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setMostrarNovoTema(false)} className="items-center py-2">
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setMostrarNovoTema(true)}
                  className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Tema</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : (
          <>
            {erroCategoria ? <Text className="text-sm text-red-600 dark:text-red-400">{erroCategoria}</Text> : null}

            {categorias.map((c) => (
              <View key={c.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Pressable onPress={() => handleVerTemasDaCategoria(c.id)}>
                  <Text className="text-base font-medium text-neutral-900 dark:text-white">{c.nome}</Text>
                  {c.descricao ? (
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">{c.descricao}</Text>
                  ) : null}
                  {ehAdministradorGlobal && !c.ativo ? (
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Inativo</Text>
                  ) : null}
                </Pressable>

                {ehAdministradorGlobal ? (
                  editandoCategoriaId === c.id ? (
                    <EditarCategoriaForm
                      categoria={c}
                      salvando={salvandoCategoria}
                      onSalvar={(dados) => handleEditarCategoria(c, dados)}
                      onCancelar={() => setEditandoCategoriaId(null)}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setEditandoCategoriaId(c.id)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))}

            {ehAdministradorGlobal ? (
              mostrarNovaCategoria ? (
                <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <TextInput
                    value={novaCategoriaNome}
                    onChangeText={setNovaCategoriaNome}
                    placeholder="Nome"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <TextInput
                    value={novaCategoriaDescricao}
                    onChangeText={setNovaCategoriaDescricao}
                    placeholder="Descrição (opcional)"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <Pressable
                    onPress={handleCriarCategoria}
                    disabled={salvandoCategoria}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {salvandoCategoria ? <ActivityIndicator /> : (
                      <Text className="font-medium text-white dark:text-neutral-900">Salvar Categoria</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setMostrarNovaCategoria(false)} className="items-center py-2">
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setMostrarNovaCategoria(true)}
                  className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Nova Categoria</Text>
                </Pressable>
              )
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EditarTemaForm({
  tema,
  categorias,
  colors,
  dropdownStyle,
  salvando,
  onSalvar,
  onCancelar,
}: {
  tema: Tema;
  categorias: Categoria[];
  colors: ReturnType<typeof useTheme>;
  dropdownStyle: object;
  salvando: boolean;
  onSalvar: (dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }) => void;
  onCancelar: () => void;
}) {
  const [numero, setNumero] = useState(tema.numero);
  const [titulo, setTitulo] = useState(tema.titulo);
  const [categoriaId, setCategoriaId] = useState(tema.categoria_id);
  const [ativo, setAtivo] = useState(tema.ativo);

  return (
    <View className="gap-3">
      <TextInput
        value={numero}
        onChangeText={setNumero}
        placeholder="Número"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Título"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <Dropdown
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={categorias.map((c) => ({ id: c.id, label: c.nome }))}
        labelField="label"
        valueField="id"
        value={categoriaId}
        placeholder="Selecionar categoria"
        onChange={(item) => setCategoriaId(item.id)}
      />
      <Pressable
        onPress={() => setAtivo(!ativo)}
        className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">{ativo ? 'Desativar' : 'Ativar'}</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onSalvar({ numero, titulo, categoriaId, ativo })}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
        <Pressable onPress={onCancelar} className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditarCategoriaForm({
  categoria,
  salvando,
  onSalvar,
  onCancelar,
}: {
  categoria: Categoria;
  salvando: boolean;
  onSalvar: (dados: { nome: string; descricao: string; ativo: boolean }) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(categoria.nome);
  const [descricao, setDescricao] = useState(categoria.descricao ?? '');
  const [ativo, setAtivo] = useState(categoria.ativo);

  return (
    <View className="gap-3">
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Descrição (opcional)"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <Pressable
        onPress={() => setAtivo(!ativo)}
        className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">{ativo ? 'Desativar' : 'Ativar'}</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onSalvar({ nome, descricao, ativo })}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
        <Pressable onPress={onCancelar} className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Add the "Catálogo" tab to `frontend/src/components/app-tabs.tsx`**

Replace:

```tsx
      <NativeTabs.Trigger name="usuarios">
        <NativeTabs.Trigger.Label>Usuários</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

with:

```tsx
      <NativeTabs.Trigger name="usuarios">
        <NativeTabs.Trigger.Label>Usuários</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalogo">
        <NativeTabs.Trigger.Label>Catálogo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 3: Add the "Catálogo" tab to `frontend/src/components/app-tabs.web.tsx`**

Replace:

```tsx
          <TabTrigger name="usuarios" href="/usuarios" asChild>
            <TabButton>Usuários</TabButton>
          </TabTrigger>
        </CustomTabList>
```

with:

```tsx
          <TabTrigger name="usuarios" href="/usuarios" asChild>
            <TabButton>Usuários</TabButton>
          </TabTrigger>
          <TabTrigger name="catalogo" href="/catalogo" asChild>
            <TabButton>Catálogo</TabButton>
          </TabTrigger>
        </CustomTabList>
```

- [ ] **Step 4: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/catalogo.tsx src/components/app-tabs.tsx src/components/app-tabs.web.tsx
git commit -m "feat(catalogo): add catalogo screen and tab entry"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only — no commit at the end unless a bug fix is needed, in which case fix it, re-verify, and commit the fix with a normal `fix(...)` message).

- [ ] **Step 1: Start the dev server**

From `frontend/`: `npm run web`, wait for `Web Bundled` in the log (poll `http://localhost:8081`, don't just sleep).

- [ ] **Step 2: Cadastro de Categoria e Tema, caminho feliz**

1. Log in as the Administrador Global.
2. Navigate to the "Catálogo" tab → confirm it opens on the Temas sub-tab, empty.
3. Switch to Categorias → "Nova Categoria" → name it (e.g. "Bíblia/Deus") → "Salvar Categoria" → confirm it appears in the list.
4. Try creating a Categoria with the same name again → confirm "Já existe uma categoria com esse nome." and no duplicate created.
5. Switch to Temas → "Novo Tema" → número "4", título "Que provas temos de que Deus existe?", categoria the one just created → "Salvar Tema" → confirm it appears in the list with the right categoria name.
6. Try creating a Tema with número "4" again → confirm "Já existe um tema com esse número." and no duplicate created.

- [ ] **Step 3: Editar e desativar**

1. Tap "Editar" on the Tema → change título, toggle to "Desativar" → "Salvar" → confirm the list updates.
2. Via `execute_sql` MCP tool (`project_id: imeoyetcbjlkrxubwldv`): `select tipo, dados from public.historicos where tipo = 'tema_editado' order by criado_em desc limit 1;` → confirm it recorded the edit.
3. Log in as a non-Administrador-Global account (Editor/Leitor/Coordenador) → Catálogo → confirm that Tema does **not** appear in the list (hidden because `ativo = false`).
4. Log back in as Administrador Global → confirm the Tema still appears, marked "Inativo".

- [ ] **Step 4: Filtro por categoria e busca**

1. As Administrador Global, on the Categorias tab, tap the Categoria → confirm it switches to the Temas tab already filtered to that categoria (only its temas show, with a "limpar filtro" link visible).
2. Tap "limpar filtro" → confirm all temas show again.
3. Type part of a título or a número in the search box → confirm the list filters correctly for both cases.

- [ ] **Step 5: Sem controles para quem não é Administrador Global**

Log in as Editor or Leitor → Catálogo → confirm no "Novo Tema"/"Nova Categoria"/"Editar" buttons appear anywhere, only the read-only lists.

- [ ] **Step 6: Segurança — tentativas diretas**

Via `execute_sql` MCP tool:

```sql
-- 1. Tentativa de INSERT como não-administrador
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-de-um-editor-ou-leitor>"}';
insert into public.temas (numero, titulo, categoria_id) values ('999', 'teste', (select id from public.categorias limit 1));
reset role;
```

Expected: rejected by RLS (no rows inserted, permission error or 0-row result depending on client).

```sql
-- 2. Tentativa de UPDATE como não-administrador
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-de-um-editor-ou-leitor>"}';
update public.temas set titulo = 'hackeado' where numero = '4';
reset role;
```

Expected: rejected by RLS (0 rows affected).

```sql
-- 3. Tentativa de DELETE como Administrador Global (confirma que a
-- policy for-all antiga foi mesmo removida)
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-do-administrador-global>"}';
delete from public.temas where numero = '4';
reset role;
```

Expected: rejected by RLS (no DELETE policy exists on `temas`/`categorias` after Task 1).

- [ ] **Step 7: Console errors**

Throughout Steps 2–6, confirm no unexpected errors were logged to the browser console.

- [ ] **Step 8: Stop the dev server**

Kill the process listening on port 8081 (`netstat`-find the PID, `taskkill`) — don't leave it running.
