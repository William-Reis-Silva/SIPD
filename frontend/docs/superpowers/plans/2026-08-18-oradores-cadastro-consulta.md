# Oradores — Cadastro, Consulta, Temas Preparados e Histórico (UC-ORA-001 a 006) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Administrador Global/Coordenador/Editor cadastrar, editar e gerenciar Oradores (a global roster of speakers, independent of user accounts) and their Temas Preparados, with all authenticated profiles able to consult Oradores and their Histórico.

**Architecture:** `oradores`/`temas_preparados` already exist with RLS that already matches the permissions matrix — no RLS change needed there. This slice adds: (1) a `BEFORE UPDATE` trigger locking `congregacao_origem_id` once an orador has a linked account, (2) a fix to the pre-existing `historicos_select` RLS policy (it only allowed reads tied to a congregação-scoped `programacao_id`, silently blocking every non-Administrador-Global read of `programacao_id IS NULL` rows — including the Catálogo/Usuários history already shipped), (3) three new hooks (`use-oradores`, `use-temas-preparados`, `use-historico-orador`) following the existing `use-categorias.ts`/`use-usuarios-congregacao.ts` query/mutation/historico pattern, (4) a pure `telefone.ts` normalization util, and (5) a new `oradores/` route folder (first nested-route branch in this codebase — `index.tsx`/`[id].tsx`/`novo.tsx` under an explicit `Stack` `_layout.tsx`) plus a new "Oradores" tab.

**Tech Stack:** Supabase (Postgres migration + RLS + trigger, applied directly to the live project), `@supabase/supabase-js`, Expo Router (`Stack`, nested routes — new pattern in this codebase), NativeWind, `react-native-element-dropdown`, no automated test framework (verification is manual).

**Spec:** `frontend/docs/superpowers/specs/2026-08-18-oradores-cadastro-consulta-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*`.
- Supabase project: `imeoyetcbjlkrxubwldv`. The migration is applied directly to this **live** project via the `apply_migration` MCP tool — there is no local Supabase stack. Double-check SQL before applying.
- No new npm dependencies.
- No RPCs — all 6 UCs in this slice use direct table access (`12-API.md`), same as Catálogo.
- `oradores`/`temas_preparados` already exist with correct base RLS — this migration only **adds** a trigger and **revises** `historicos_select` (`alter`/`drop policy`/`create policy`), it does not `create table`.
- Historico convention (verbatim, per spec): `historicos` has no `orador_id` column — every orador-related event carries `dados->>'orador_id'` instead, with `usuario_id: null`. Log `orador_criado` (UC-ORA-001), `orador_editado` (UC-ORA-002), `tema_preparado_editado`/`tema_preparado_removido` (UC-ORA-005). Do **not** log on "adicionar tema preparado" (UC-ORA-004 isolated — matches the existing "criar não loga" convention from Catálogo).
- Exception-tag convention (verbatim, matches `20260817120000_gerenciar_usuarios_congregacao.sql`): Postgres `raise exception` uses a short snake_case tag (e.g. `'origem_travada_orador_vinculado'`), matched in the frontend via `error.message.includes('tag')` — never match on the full Portuguese sentence.
- Error copy (verbatim, per spec):
  - Telefone duplicado: `"Já existe um orador com esse telefone."`
  - Telefone inválido: `"Informe um telefone válido, com DDD."`
  - Tema já preparado: `"Esse tema já está entre os preparados do orador."`
  - Trava de congregação de origem: `"Apenas o próprio orador vinculado pode alterar a congregação de origem."`
  - Falha genérica ao salvar: `"Não foi possível salvar. Tente novamente."`
  - Falha ao carregar: `"Não foi possível carregar os oradores."`
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, `ScrollView` wrapping a `View` capped at `MaxContentWidth` (`@/constants/theme`), matching `usuarios.tsx`. Reuse `useTheme()` (`@/hooks/use-theme`) for `Dropdown` colors (`dropdownStyle` object repeated exactly as in `estado-cidade-picker.tsx`/`usuarios.tsx`). Ativo/Inativo and similar booleans are a toggle button (`Pressable` + `Text`, "Ativar"/"Desativar"), not a native `Switch` — no `Switch` precedent in this codebase.
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every frontend task before committing.
- `AGENTS.md` in `frontend/` warns that Expo has changed recently — this slice introduces the **first nested route folder** in this codebase (`oradores/index.tsx`, `oradores/[id].tsx`, `oradores/novo.tsx` under `oradores/_layout.tsx`). If `Stack`/tab navigation between these misbehaves (e.g. back navigation, or the "Oradores" tab not landing on `oradores/index.tsx`), check `https://docs.expo.dev/versions/v57.0.0/router/` before improvising a workaround — do not silently fall back to a flatter structure without understanding why the nested Stack didn't work.
- `EstadoCidadePicker` (`@/features/congregacoes/estado-cidade-picker`) is reused as-is (cidade de residência) — do not modify it.

---

### Task 1: Database — trigger de trava de origem, revisão de `historicos_select`

**Files:**
- Create: `database/migrations/20260818240000_oradores_cadastro_consulta.sql`

**Interfaces:**
- Produces:
  - Function + trigger `travar_origem_orador_vinculado` on `public.oradores` (`before update`) — raises `'origem_travada_orador_vinculado'` when `congregacao_origem_id` changes and the orador already has `usuario_id` set to someone other than the caller, unless the caller is Administrador Global.
  - Revised RLS policy `historicos_select` on `public.historicos` — replaces the old one, adding a `programacao_id is null` branch so every authenticated user can read historico rows not tied to a congregação-scoped programação (matches the existing `historicos_insert` policy, which already allows this).

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the `apply_migration` MCP tool (`project_id: imeoyetcbjlkrxubwldv`, `name: oradores_cadastro_consulta`) with this SQL:

```sql
-- ----------------------------------------------------------------------------
-- 1. Trigger: trava condicional de congregacao_origem_id (UC-ORA-002 FA-02)
-- Coordenador/Editor podem editar normalmente enquanto o orador não tiver
-- conta vinculada. A partir do momento em que usuario_id é preenchido, só
-- o próprio orador ou o Administrador Global podem mudar a origem.
-- ----------------------------------------------------------------------------
create or replace function public.travar_origem_orador_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.congregacao_origem_id is distinct from old.congregacao_origem_id then
    if old.usuario_id is not null
       and old.usuario_id <> auth.uid()
       and not public.is_administrador_global() then
      raise exception 'origem_travada_orador_vinculado';
    end if;
  end if;
  return new;
end;
$$;

create trigger travar_origem_orador_vinculado
  before update on public.oradores
  for each row execute function public.travar_origem_orador_vinculado();

-- ----------------------------------------------------------------------------
-- 2. Revisão de historicos_select — a policy original só liberava leitura
-- de linhas com programacao_id resolvendo para a congregação do usuário (ou
-- Administrador Global). Linhas com programacao_id NULL (todo o histórico já
-- existente de Catálogo/Usuários, e o novo histórico de Oradores desta fatia)
-- ficavam invisíveis para quem não é Administrador Global — a policy de
-- INSERT já permitia programacao_id NULL para todo authenticated, então essa
-- leitura já deveria ter sido liberada do mesmo jeito.
-- ----------------------------------------------------------------------------
drop policy historicos_select on public.historicos;

create policy historicos_select on public.historicos
  for select to authenticated
  using (
    public.is_administrador_global()
    or programacao_id is null
    or exists (
      select 1 from public.programacoes p
      where p.id = historicos.programacao_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
  );
```

Expected: tool reports success.

- [ ] **Step 2: Verify the new objects exist**

Run (via `execute_sql` MCP tool, `project_id: imeoyetcbjlkrxubwldv`):

```sql
select tgname from pg_trigger where tgname = 'travar_origem_orador_vinculado';

select policyname, cmd, qual from pg_policies
where tablename = 'historicos' and policyname = 'historicos_select';
```

Expected:
- First query: one row.
- Second query: one row, `qual` containing `programacao_id IS NULL`.

- [ ] **Step 3: Save the migration as a local file**

Create `database/migrations/20260818240000_oradores_cadastro_consulta.sql` with a header comment (mirroring existing migration files) followed by the exact SQL from Step 1:

```sql
-- ============================================================================
-- SIPD — Migração: Oradores (UC-ORA-001 a 006)
-- ============================================================================
--
-- Contexto:
-- oradores/temas_preparados já existiam com RLS já correta (sem mudança
-- aqui). Esta migração adiciona:
-- 1. Trigger que trava congregacao_origem_id para Coordenador/Editor quando
--    o orador já tem conta vinculada (UC-ORA-002 FA-02) — só o próprio
--    orador ou o Administrador Global podem mudar nesse caso.
-- 2. Correção de historicos_select: a policy original não liberava leitura
--    de linhas com programacao_id NULL para não-Administrador-Global,
--    contrariando a permissão já dada por historicos_insert e bloqueando
--    silenciosamente o histórico de Catálogo/Usuários já em produção, além
--    do novo histórico de Oradores desta fatia.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-18-oradores-cadastro-consulta-design.md
-- ============================================================================

<same SQL as Step 1>
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/20260818240000_oradores_cadastro_consulta.sql
git commit -m "feat(oradores): add origem-lock trigger and fix historicos_select RLS gap"
```

---

### Task 2: `telefone.ts` — normalização e formatação

**Files:**
- Create: `frontend/src/features/oradores/telefone.ts`

**Interfaces:**
- Produces (used by Tasks 3, 6, 7):
  ```ts
  export function normalizarTelefone(valor: string): string | null;
  export function formatarTelefone(normalizado: string): string;
  ```

- [ ] **Step 1: Create `frontend/src/features/oradores/telefone.ts`**

```ts
export function normalizarTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '');

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return digitos;
  }
  return null;
}

export function formatarTelefone(normalizado: string): string {
  const semPais = normalizado.startsWith('55') ? normalizado.slice(2) : normalizado;
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);

  if (resto.length === 9) {
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
  }
  if (resto.length === 8) {
    return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  }
  return normalizado;
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual sanity check**

Run (from `frontend/`, requires no build step since this is plain TS with no imports):

```bash
node -e "
const ts = require('fs').readFileSync('src/features/oradores/telefone.ts', 'utf8');
const js = ts.replace('export function', 'function');
eval(js);
console.log(normalizarTelefone('(11) 99999-1111'));
console.log(normalizarTelefone('11999991111'));
console.log(normalizarTelefone('123'));
console.log(formatarTelefone('5511999991111'));
console.log(formatarTelefone('551133334444'));
"
```

Expected output (5 lines): `5511999991111`, `5511999991111`, `null`, `(11) 99999-1111`, `(11) 3333-4444`.

- [ ] **Step 4: Commit**

```bash
git add src/features/oradores/telefone.ts
git commit -m "feat(oradores): add telefone normalization util"
```

---

### Task 3: `use-oradores.ts` hook

**Files:**
- Create: `frontend/src/features/oradores/use-oradores.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`, `useAuth()` from `@/features/administracao/use-auth`.
- Produces (used by Tasks 6, 7, 8):
  ```ts
  export type Orador = {
    id: string;
    nome: string;
    sobrenome: string;
    telefone_normalizado: string;
    email: string | null;
    cidade_id: string;
    cidade: { id: string; nome: string; estado_id: string };
    congregacao_origem_id: string;
    congregacao_origem: { id: string; nome: string; numero: string };
    usuario_id: string | null;
    ativo: boolean;
    temas_preparados: { tema_id: string }[];
  };
  export type OradoresStatus = 'loading' | 'ready' | 'error';
  export type OradorInput = {
    nome: string;
    sobrenome: string;
    telefoneNormalizado: string;
    email: string;
    cidadeId: string;
    congregacaoOrigemId: string;
  };
  function useOradores(): {
    status: OradoresStatus;
    oradores: Orador[];
    criarOrador: (input: OradorInput) => Promise<{ error: string | null; orador: Orador | null }>;
    editarOrador: (orador: Orador, input: OradorInput) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/oradores/use-oradores.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Orador = {
  id: string;
  nome: string;
  sobrenome: string;
  telefone_normalizado: string;
  email: string | null;
  cidade_id: string;
  cidade: { id: string; nome: string; estado_id: string };
  congregacao_origem_id: string;
  congregacao_origem: { id: string; nome: string; numero: string };
  usuario_id: string | null;
  ativo: boolean;
  temas_preparados: { tema_id: string }[];
};

export type OradoresStatus = 'loading' | 'ready' | 'error';

export type OradorInput = {
  nome: string;
  sobrenome: string;
  telefoneNormalizado: string;
  email: string;
  cidadeId: string;
  congregacaoOrigemId: string;
};

const ORADORES_SELECT =
  'id, nome, sobrenome, telefone_normalizado, email, cidade_id, cidade:cidades(id, nome, estado_id), ' +
  'congregacao_origem_id, congregacao_origem:congregacoes!congregacao_origem_id(id, nome, numero), ' +
  'usuario_id, ativo, temas_preparados(tema_id)';

const UNIQUE_VIOLATION = '23505';
const ERRO_TELEFONE_DUPLICADO = 'Já existe um orador com esse telefone.';
const ERRO_TRAVA_ORIGEM = 'Apenas o próprio orador vinculado pode alterar a congregação de origem.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

function paraInsertUpdate(input: OradorInput) {
  return {
    nome: input.nome,
    sobrenome: input.sobrenome,
    telefone_normalizado: input.telefoneNormalizado,
    email: input.email || null,
    cidade_id: input.cidadeId,
    congregacao_origem_id: input.congregacaoOrigemId,
  };
}

export function useOradores() {
  const { usuario } = useAuth();
  const [oradores, setOradores] = useState<Orador[]>([]);
  const [status, setStatus] = useState<OradoresStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase.from('oradores').select(ORADORES_SELECT).order('nome');

    if (error) {
      setStatus('error');
      return;
    }

    setOradores((data ?? []) as unknown as Orador[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarOrador(input: OradorInput): Promise<{ error: string | null; orador: Orador | null }> {
    const { data, error } = await supabase
      .from('oradores')
      .insert(paraInsertUpdate(input))
      .select(ORADORES_SELECT)
      .single();

    if (error || !data) {
      if (error?.code === UNIQUE_VIOLATION) return { error: ERRO_TELEFONE_DUPLICADO, orador: null };
      return { error: ERRO_SALVAR, orador: null };
    }

    const orador = data as unknown as Orador;

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'orador_criado',
      descricao: 'Orador cadastrado',
      dados: { orador_id: orador.id, nome: orador.nome, sobrenome: orador.sobrenome },
    });

    await carregar();
    return { error: null, orador };
  }

  async function editarOrador(orador: Orador, input: OradorInput): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('oradores')
      .update(paraInsertUpdate(input))
      .eq('id', orador.id);

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_TELEFONE_DUPLICADO };
      if (error.message.includes('origem_travada_orador_vinculado')) return { error: ERRO_TRAVA_ORIGEM };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'orador_editado',
      descricao: 'Orador editado',
      dados: {
        orador_id: orador.id,
        nome_anterior: orador.nome,
        nome_novo: input.nome,
        telefone_anterior: orador.telefone_normalizado,
        telefone_novo: input.telefoneNormalizado,
        congregacao_origem_anterior_id: orador.congregacao_origem_id,
        congregacao_origem_nova_id: input.congregacaoOrigemId,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, oradores, criarOrador, editarOrador };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/oradores/use-oradores.ts
git commit -m "feat(oradores): add use-oradores hook"
```

---

### Task 4: `use-temas-preparados.ts` hook

**Files:**
- Create: `frontend/src/features/oradores/use-temas-preparados.ts`

**Interfaces:**
- Consumes: `supabase`, `useAuth()`.
- Produces (used by Task 8):
  ```ts
  export type TemaPreparado = {
    id: string;
    tema_id: string;
    observacoes: string | null;
    tema: { id: string; numero: string; titulo: string };
  };
  export type TemasPreparadosStatus = 'loading' | 'ready' | 'error';
  function useTemasPreparados(oradorId: string): {
    status: TemasPreparadosStatus;
    temasPreparados: TemaPreparado[];
    adicionarTemaPreparado: (temaId: string) => Promise<{ error: string | null }>;
    editarObservacoes: (temaPreparado: TemaPreparado, observacoes: string) => Promise<{ error: string | null }>;
    removerTemaPreparado: (temaPreparado: TemaPreparado) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/oradores/use-temas-preparados.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type TemaPreparado = {
  id: string;
  tema_id: string;
  observacoes: string | null;
  tema: { id: string; numero: string; titulo: string };
};

export type TemasPreparadosStatus = 'loading' | 'ready' | 'error';

const TEMAS_PREPARADOS_SELECT = 'id, tema_id, observacoes, tema:temas(id, numero, titulo)';
const UNIQUE_VIOLATION = '23505';
const ERRO_TEMA_DUPLICADO = 'Esse tema já está entre os preparados do orador.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useTemasPreparados(oradorId: string) {
  const { usuario } = useAuth();
  const [temasPreparados, setTemasPreparados] = useState<TemaPreparado[]>([]);
  const [status, setStatus] = useState<TemasPreparadosStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !oradorId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('temas_preparados')
      .select(TEMAS_PREPARADOS_SELECT)
      .eq('orador_id', oradorId)
      .order('criado_em');

    if (error) {
      setStatus('error');
      return;
    }

    setTemasPreparados((data ?? []) as unknown as TemaPreparado[]);
    setStatus('ready');
  }, [usuario?.id, oradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionarTemaPreparado(temaId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas_preparados')
      .insert({ orador_id: oradorId, tema_id: temaId });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_TEMA_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarObservacoes(
    temaPreparado: TemaPreparado,
    observacoes: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas_preparados')
      .update({ observacoes: observacoes || null })
      .eq('id', temaPreparado.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_preparado_editado',
      descricao: 'Observações do tema preparado editadas',
      dados: {
        orador_id: oradorId,
        tema_preparado_id: temaPreparado.id,
        tema_id: temaPreparado.tema_id,
        observacoes_anteriores: temaPreparado.observacoes,
        observacoes_novas: observacoes,
      },
    });

    await carregar();
    return { error: null };
  }

  async function removerTemaPreparado(temaPreparado: TemaPreparado): Promise<{ error: string | null }> {
    const { error } = await supabase.from('temas_preparados').delete().eq('id', temaPreparado.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_preparado_removido',
      descricao: 'Tema preparado removido',
      dados: { orador_id: oradorId, tema_id: temaPreparado.tema_id },
    });

    await carregar();
    return { error: null };
  }

  return { status, temasPreparados, adicionarTemaPreparado, editarObservacoes, removerTemaPreparado };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/oradores/use-temas-preparados.ts
git commit -m "feat(oradores): add use-temas-preparados hook"
```

---

### Task 5: `use-historico-orador.ts` hook

**Files:**
- Create: `frontend/src/features/oradores/use-historico-orador.ts`

**Interfaces:**
- Consumes: `supabase`, `useAuth()`.
- Produces (used by Task 8):
  ```ts
  export type EventoHistorico = {
    id: string;
    tipo: string;
    descricao: string;
    dados: Record<string, unknown> | null;
    criado_em: string;
  };
  export type HistoricoOradorStatus = 'loading' | 'ready' | 'error';
  function useHistoricoOrador(oradorId: string): {
    status: HistoricoOradorStatus;
    eventos: EventoHistorico[];
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/oradores/use-historico-orador.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistorico = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoOradorStatus = 'loading' | 'ready' | 'error';

export function useHistoricoOrador(oradorId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [status, setStatus] = useState<HistoricoOradorStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !oradorId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('dados->>orador_id', oradorId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistorico[]);
    setStatus('ready');
  }, [usuario?.id, oradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/oradores/use-historico-orador.ts
git commit -m "feat(oradores): add use-historico-orador hook"
```

---

### Task 6: `oradores/_layout.tsx` + `oradores/index.tsx` (lista) + tab entry

**Files:**
- Create: `frontend/src/app/(app)/oradores/_layout.tsx`
- Create: `frontend/src/app/(app)/oradores/index.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: `useOradores` (Task 3, `Orador` type), `useTemas` from `@/features/catalogo/use-temas` (for the tema filter dropdown), `useAuth()`, `useTheme()`.

- [ ] **Step 1: Create `frontend/src/app/(app)/oradores/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function OradoresLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create `frontend/src/app/(app)/oradores/index.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useOradores } from '@/features/oradores/use-oradores';
import { useTemas } from '@/features/catalogo/use-temas';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

export default function OradoresListaScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, oradores } = useOradores();
  const { temas } = useTemas();

  const [busca, setBusca] = useState('');
  const [temaFiltroId, setTemaFiltroId] = useState<string | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const oradoresFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return oradores.filter((o) => {
      if (temaFiltroId && !o.temas_preparados.some((tp) => tp.tema_id === temaFiltroId)) return false;
      if (!buscaNormalizada) return true;
      const nomeCompleto = `${o.nome} ${o.sobrenome}`.toLowerCase();
      return nomeCompleto.includes(buscaNormalizada) || o.telefone_normalizado.includes(buscaNormalizada);
    });
  }, [oradores, busca, temaFiltroId]);

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os oradores.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Oradores</Text>

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome ou telefone"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />

          <Dropdown
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={[{ id: '', label: 'Todos os temas' }, ...temas.map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }))]}
            labelField="label"
            valueField="id"
            value={temaFiltroId ?? ''}
            placeholder="Filtrar por tema"
            search
            searchPlaceholder="Buscar tema..."
            onChange={(item) => setTemaFiltroId(item.id || null)}
          />

          {oradoresFiltrados.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => router.push(`/oradores/${o.id}`)}
              className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <Text className="text-base font-medium text-neutral-900 dark:text-white">
                {o.nome} {o.sobrenome}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {o.congregacao_origem.nome} · {o.cidade.nome}
              </Text>
            </Pressable>
          ))}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/oradores/novo')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Orador</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Add the "Oradores" tab to `frontend/src/components/app-tabs.tsx`**

Replace:

```tsx
      <NativeTabs.Trigger name="temas">
        <NativeTabs.Trigger.Label>Temas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

with:

```tsx
      <NativeTabs.Trigger name="temas">
        <NativeTabs.Trigger.Label>Temas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="oradores">
        <NativeTabs.Trigger.Label>Oradores</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 4: Add the "Oradores" tab to `frontend/src/components/app-tabs.web.tsx`**

Replace:

```tsx
          <TabTrigger name="temas" href="/temas" asChild>
            <TabButton>Temas</TabButton>
          </TabTrigger>
        </CustomTabList>
```

with:

```tsx
          <TabTrigger name="temas" href="/temas" asChild>
            <TabButton>Temas</TabButton>
          </TabTrigger>
          <TabTrigger name="oradores" href="/oradores" asChild>
            <TabButton>Oradores</TabButton>
          </TabTrigger>
        </CustomTabList>
```

- [ ] **Step 5: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. (`[id].tsx`/`novo.tsx` don't exist yet — `router.push` string paths aren't statically checked against route files by default in this project, so this compiles regardless of Task 7/8 ordering.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/oradores/_layout.tsx" "src/app/(app)/oradores/index.tsx" src/components/app-tabs.tsx src/components/app-tabs.web.tsx
git commit -m "feat(oradores): add oradores list screen, nested Stack layout, and tab entry"
```

---

### Task 7: `oradores/novo.tsx` (cadastro)

**Files:**
- Create: `frontend/src/app/(app)/oradores/novo.tsx`

**Interfaces:**
- Consumes: `useOradores` (Task 3), `normalizarTelefone` (Task 2), `EstadoCidadePicker` (`@/features/congregacoes/estado-cidade-picker`, unchanged), `useTheme()`.

- [ ] **Step 1: Create `frontend/src/app/(app)/oradores/novo.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useOradores } from '@/features/oradores/use-oradores';
import { normalizarTelefone } from '@/features/oradores/telefone';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';

type CongregacaoOpcao = { id: string; nome: string; numero: string };

const ERRO_CAMPOS = 'Preencha nome, sobrenome, telefone, cidade e congregação de origem.';
const ERRO_TELEFONE_INVALIDO = 'Informe um telefone válido, com DDD.';

export default function NovoOradorScreen() {
  const colors = useTheme();
  const { criarOrador } = useOradores();

  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [congregacaoOrigemId, setCongregacaoOrigemId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  useEffect(() => {
    let ignorar = false;
    supabase
      .from('congregacoes')
      .select('id, nome, numero')
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCongregacoes((data ?? []) as CongregacaoOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, []);

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !cidadeId || !congregacaoOrigemId) {
      setErro(ERRO_CAMPOS);
      return;
    }

    const telefoneNormalizado = normalizarTelefone(telefone);
    if (!telefoneNormalizado) {
      setErro(ERRO_TELEFONE_INVALIDO);
      return;
    }

    setSalvando(true);
    const { error, orador } = await criarOrador({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefoneNormalizado,
      email: email.trim(),
      cidadeId,
      congregacaoOrigemId,
    });
    setSalvando(false);

    if (error || !orador) {
      setErro(error ?? ERRO_CAMPOS);
      return;
    }

    router.replace(`/oradores/${orador.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Novo Orador</Text>

          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={sobrenome}
            onChangeText={setSobrenome}
            placeholder="Sobrenome"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={telefone}
            onChangeText={setTelefone}
            placeholder="Telefone, com DDD"
            keyboardType="phone-pad"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail (opcional)"
            keyboardType="email-address"
            autoCapitalize="none"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />

          <EstadoCidadePicker
            estadoId={estadoId}
            cidadeId={cidadeId}
            onEstadoChange={setEstadoId}
            onCidadeChange={setCidadeId}
            onErro={setErro}
          />

          <Dropdown
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }))}
            labelField="label"
            valueField="id"
            value={congregacaoOrigemId}
            placeholder="Congregação de origem"
            search
            searchPlaceholder="Buscar congregação..."
            onChange={(item) => setCongregacaoOrigemId(item.id)}
          />

          {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

          <Pressable
            onPress={handleSalvar}
            disabled={salvando}
            className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {salvando ? <ActivityIndicator /> : (
              <Text className="font-medium text-white dark:text-neutral-900">Salvar Orador</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/oradores/novo.tsx"
git commit -m "feat(oradores): add novo orador screen"
```

---

### Task 8: `oradores/[id].tsx` (detalhe: Dados, Temas Preparados, Histórico)

**Files:**
- Create: `frontend/src/app/(app)/oradores/[id].tsx`

**Interfaces:**
- Consumes: `useOradores` (Task 3), `useTemasPreparados` (Task 4), `useHistoricoOrador` (Task 5), `useTemas` from `@/features/catalogo/use-temas` (for the "adicionar tema" picker), `normalizarTelefone`/`formatarTelefone` (Task 2), `EstadoCidadePicker`, `useAuth()`, `useTheme()`.

- [ ] **Step 1: Create `frontend/src/app/(app)/oradores/[id].tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useOradores, type Orador } from '@/features/oradores/use-oradores';
import { useTemasPreparados, type TemaPreparado } from '@/features/oradores/use-temas-preparados';
import { useHistoricoOrador } from '@/features/oradores/use-historico-orador';
import { useTemas } from '@/features/catalogo/use-temas';
import { normalizarTelefone, formatarTelefone } from '@/features/oradores/telefone';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const ERRO_CAMPOS = 'Preencha nome, sobrenome, telefone, cidade e congregação de origem.';
const ERRO_TELEFONE_INVALIDO = 'Informe um telefone válido, com DDD.';

type Secao = 'dados' | 'temas' | 'historico';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function OradorDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, oradores, editarOrador } = useOradores();
  const orador = oradores.find((o) => o.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !orador) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os oradores.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {orador.nome} {orador.sobrenome}
          </Text>

          <View className="flex-row gap-3">
            {(['dados', 'temas', 'historico'] as Secao[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSecao(s)}
                className={`flex-1 items-center rounded-lg border px-3 py-2 ${secao === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s === 'dados' ? 'Dados' : s === 'temas' ? 'Temas Preparados' : 'Histórico'}
                </Text>
              </Pressable>
            ))}
          </View>

          {secao === 'dados' ? (
            <SecaoDados orador={orador} podeGerenciar={podeGerenciar} colors={colors} editarOrador={editarOrador} />
          ) : null}
          {secao === 'temas' ? (
            <SecaoTemasPreparados oradorId={orador.id} podeGerenciar={podeGerenciar} colors={colors} />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico oradorId={orador.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  orador,
  podeGerenciar,
  colors,
  editarOrador,
}: {
  orador: Orador;
  podeGerenciar: boolean;
  colors: ReturnType<typeof useTheme>;
  editarOrador: (orador: Orador, input: Parameters<ReturnType<typeof useOradores>['editarOrador']>[1]) => ReturnType<ReturnType<typeof useOradores>['editarOrador']>;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(orador.nome);
  const [sobrenome, setSobrenome] = useState(orador.sobrenome);
  const [telefone, setTelefone] = useState(formatarTelefone(orador.telefone_normalizado));
  const [email, setEmail] = useState(orador.email ?? '');
  const [estadoId, setEstadoId] = useState(orador.cidade.estado_id);
  const [cidadeId, setCidadeId] = useState(orador.cidade_id);
  const [congregacaoOrigemId, setCongregacaoOrigemId] = useState(orador.congregacao_origem_id);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function iniciarEdicao() {
    setNome(orador.nome);
    setSobrenome(orador.sobrenome);
    setTelefone(formatarTelefone(orador.telefone_normalizado));
    setEmail(orador.email ?? '');
    setEstadoId(orador.cidade.estado_id);
    setCidadeId(orador.cidade_id);
    setCongregacaoOrigemId(orador.congregacao_origem_id);
    setErro(null);
    setEditando(true);
  }

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !cidadeId || !congregacaoOrigemId) {
      setErro(ERRO_CAMPOS);
      return;
    }

    const telefoneNormalizado = normalizarTelefone(telefone);
    if (!telefoneNormalizado) {
      setErro(ERRO_TELEFONE_INVALIDO);
      return;
    }

    setSalvando(true);
    const { error } = await editarOrador(orador, {
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefoneNormalizado,
      email: email.trim(),
      cidadeId,
      congregacaoOrigemId,
    });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }

    setEditando(false);
  }

  if (!editando) {
    return (
      <View className="gap-4">
        <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Telefone</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{formatarTelefone(orador.telefone_normalizado)}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">E-mail</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.email ?? 'Não informado'}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.cidade.nome}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Congregação de origem</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.congregacao_origem.nome}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Conta</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {orador.usuario_id ? 'Conta vinculada' : 'Sem conta vinculada'}
            </Text>
          </View>
        </View>

        {podeGerenciar ? (
          <Pressable
            onPress={iniciarEdicao}
            className="items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={sobrenome}
        onChangeText={setSobrenome}
        placeholder="Sobrenome"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={telefone}
        onChangeText={setTelefone}
        placeholder="Telefone, com DDD"
        keyboardType="phone-pad"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="E-mail (opcional)"
        keyboardType="email-address"
        autoCapitalize="none"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <EstadoCidadePicker
        estadoId={estadoId}
        cidadeId={cidadeId}
        onEstadoChange={setEstadoId}
        onCidadeChange={setCidadeId}
        onErro={setErro}
      />

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
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function SecaoTemasPreparados({
  oradorId,
  podeGerenciar,
  colors,
}: {
  oradorId: string;
  podeGerenciar: boolean;
  colors: ReturnType<typeof useTheme>;
}) {
  const { status, temasPreparados, adicionarTemaPreparado, editarObservacoes, removerTemaPreparado } =
    useTemasPreparados(oradorId);
  const { temas } = useTemas();

  const [temaParaAdicionar, setTemaParaAdicionar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [observacoesEmEdicao, setObservacoesEmEdicao] = useState<Record<string, string>>({});

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temasDisponiveis = useMemo(() => {
    const jaAdicionados = new Set(temasPreparados.map((tp) => tp.tema_id));
    return temas.filter((t) => t.ativo && !jaAdicionados.has(t.id));
  }, [temas, temasPreparados]);

  async function handleAdicionar() {
    setErro(null);
    if (!temaParaAdicionar) return;

    setProcessando(true);
    const { error } = await adicionarTemaPreparado(temaParaAdicionar);
    setProcessando(false);

    if (error) {
      setErro(error);
      return;
    }
    setTemaParaAdicionar('');
  }

  async function handleSalvarObservacoes(tp: TemaPreparado) {
    setErro(null);
    setProcessando(true);
    const { error } = await editarObservacoes(tp, observacoesEmEdicao[tp.id] ?? tp.observacoes ?? '');
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleRemover(tp: TemaPreparado) {
    setErro(null);
    setProcessando(true);
    const { error } = await removerTemaPreparado(tp);
    setProcessando(false);
    if (error) setErro(error);
  }

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  return (
    <View className="gap-3">
      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {temasPreparados.map((tp) => (
        <View key={tp.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-base font-medium text-neutral-900 dark:text-white">
            {tp.tema.numero}. {tp.tema.titulo}
          </Text>

          {podeGerenciar ? (
            <>
              <TextInput
                value={observacoesEmEdicao[tp.id] ?? tp.observacoes ?? ''}
                onChangeText={(texto) => setObservacoesEmEdicao((atual) => ({ ...atual, [tp.id]: texto }))}
                placeholder="Observações (opcional)"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => handleSalvarObservacoes(tp)}
                  disabled={processando}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Salvar observações</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRemover(tp)}
                  disabled={processando}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Remover</Text>
                </Pressable>
              </View>
            </>
          ) : tp.observacoes ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{tp.observacoes}</Text>
          ) : null}
        </View>
      ))}

      {podeGerenciar ? (
        <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Dropdown
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={temasDisponiveis.map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }))}
            labelField="label"
            valueField="id"
            value={temaParaAdicionar}
            placeholder="Selecionar tema"
            search
            searchPlaceholder="Buscar tema..."
            onChange={(item) => setTemaParaAdicionar(item.id)}
          />
          <Pressable
            onPress={handleAdicionar}
            disabled={processando || !temaParaAdicionar}
            className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {processando ? <ActivityIndicator /> : (
              <Text className="font-medium text-white dark:text-neutral-900">Adicionar Tema</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ oradorId }: { oradorId: string }) {
  const { status, eventos } = useHistoricoOrador(oradorId);

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  if (eventos.length === 0) {
    return (
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum evento registrado ainda.</Text>
    );
  }

  return (
    <View className="gap-3">
      {eventos.map((e) => (
        <View key={e.id} className="gap-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">{e.descricao}</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{formatarDataHora(e.criado_em)}</Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/oradores/[id].tsx"
git commit -m "feat(oradores): add orador detail screen (dados, temas preparados, historico)"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only — no commit at the end unless a bug fix is needed, in which case fix it, re-verify, and commit the fix with a normal `fix(...)` message).

- [ ] **Step 1: Start the dev server**

From `frontend/`: `npm run web`, wait for `Web Bundled` in the log (poll `http://localhost:8081`, don't just sleep).

- [ ] **Step 2: Navegação — nova aba, lista, detalhe, voltar**

1. Log in as the Administrador Global.
2. Confirm a new "Oradores" tab appears and opens on `/oradores`, empty list.
3. Tap "Novo Orador" → confirm it navigates to `/oradores/novo` (still on the Oradores tab, no tab-bar flicker to a different tab).

- [ ] **Step 3: Cadastro, caminho feliz**

1. On `/oradores/novo`: fill nome, sobrenome, telefone (e.g. "(11) 99999-1111"), pick Estado/Cidade, pick a Congregação de origem → "Salvar Orador".
2. Confirm it redirects to `/oradores/<id>` showing the new orador's Dados, telefone formatted as `(11) 99999-1111`, "Sem conta vinculada".
3. Tap "‹ Voltar" (or navigate back to `/oradores`) → confirm the new orador appears in the list.
4. Via `execute_sql` MCP tool: `select tipo, dados from public.historicos where tipo = 'orador_criado' order by criado_em desc limit 1;` → confirm it recorded the `orador_id`.

- [ ] **Step 4: Duplicidade e validação**

1. Try creating another Orador with the same telefone → confirm "Já existe um orador com esse telefone." and no duplicate created.
2. Try creating an Orador with an invalid telefone (e.g. "123") → confirm "Informe um telefone válido, com DDD." without a network round-trip.

- [ ] **Step 5: Editar dados e trava de origem**

1. Open the orador created in Step 3, tap "Editar" → change nome and telefone → "Salvar" → confirm the update and `orador_editado` in `historicos` (same query pattern as Step 3.4, `tipo = 'orador_editado'`).
2. As Coordenador or Editor (not the orador's `usuario_id`, still null at this point) → try changing the Congregação de origem → confirm it's allowed (no `usuario_id` set yet).
3. Via `execute_sql` MCP tool, simulate a linked account: `update public.oradores set usuario_id = '<uuid-de-um-usuario-qualquer>' where id = '<id-do-orador>';`
4. As Coordenador or Editor, try changing that orador's Congregação de origem again → confirm it's rejected with "Apenas o próprio orador vinculado pode alterar a congregação de origem."
5. As Administrador Global, try the same change → confirm it's allowed (AG bypasses the trigger).
6. Via `execute_sql` MCP tool, revert: `update public.oradores set usuario_id = null where id = '<id-do-orador>';`

- [ ] **Step 6: Temas Preparados**

1. On the orador's detail screen, switch to "Temas Preparados" → "Adicionar Tema" → pick one → confirm it appears in the list.
2. Via `execute_sql` MCP tool: confirm **no** new row in `historicos` for this orador with `tipo = 'tema_preparado_editado'` or `'tema_preparado_removido'` (UC-ORA-004 isolated add doesn't log).
3. Edit that tema's "Observações" field → "Salvar observações" → confirm it persists (reload the screen) and a `tema_preparado_editado` row now exists in `historicos` with the right `orador_id`/`tema_id`.
4. "Remover" the tema → confirm it disappears from the list and a `tema_preparado_removido` row exists in `historicos`.
5. Try adding the same tema twice in a row (re-add, then attempt to add again before the list refreshes if possible, or check the dropdown no longer offers an already-added tema) → confirm already-added temas don't appear in the "Selecionar tema" dropdown.

- [ ] **Step 7: Histórico e permissão de consulta**

1. On the orador's detail screen, switch to "Histórico" → confirm the `orador_criado`/`orador_editado`/`tema_preparado_editado`/`tema_preparado_removido` events from the previous steps all appear, most recent first.
2. Log in as a Leitor (or Editor/Coordenador) → open the same orador → "Histórico" → confirm the events are visible (this is the RLS fix from Task 1 — before it, only Administrador Global could see any of this).
3. As the same non-Administrador-Global user, confirm no "Novo Orador" button appears in the list, and the detail screen's "Dados"/"Temas Preparados" show no "Editar"/"Adicionar Tema"/"Remover" controls (Leitor) or that they do appear (Coordenador/Editor).

- [ ] **Step 8: Busca e filtro por tema**

1. On `/oradores`, type part of a name or the telefone in the search box → confirm the list filters correctly for both.
2. Select a tema in "Filtrar por tema" → confirm only oradores with that tema preparado show; select "Todos os temas" → confirm the full list returns.

- [ ] **Step 9: Segurança — tentativas diretas**

Via `execute_sql` MCP tool:

```sql
-- 1. Tentativa de UPDATE de congregacao_origem_id por um não-vinculado
-- após o orador ter usuario_id preenchido (repete o Passo 5, direto via SQL
-- simulando o cliente, sem passar pelo hook)
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-de-um-editor>"}';
update public.oradores set congregacao_origem_id = (select id from public.congregacoes limit 1)
  where id = '<id-de-um-orador-com-usuario_id-preenchido>';
reset role;
```

Expected: rejected by the trigger (`origem_travada_orador_vinculado`).

```sql
-- 2. Tentativa de DELETE em oradores (nenhuma policy de DELETE existe)
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-do-administrador-global>"}';
delete from public.oradores where id = '<qualquer-id>';
reset role;
```

Expected: rejected by RLS (no DELETE policy on `oradores`).

- [ ] **Step 10: Console errors**

Throughout Steps 2–9, confirm no unexpected errors were logged to the browser console.

- [ ] **Step 11: Stop the dev server**

Kill the process listening on port 8081 (`netstat`-find the PID, `taskkill`) — don't leave it running.
