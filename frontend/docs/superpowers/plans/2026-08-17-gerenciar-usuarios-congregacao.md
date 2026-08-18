# Gerenciar Usuários da Congregação (UC-CGR-003) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Coordenador (or Administrador Global) list, invite, edit, and activate/deactivate the users of their congregação — including inviting a brand-new person or transferring an existing user in from another congregação — all through a code/link invite mechanism instead of real transactional e-mail.

**Architecture:** A new `convites_usuario` table plus three `security definer` RPCs (`criar_convite_usuario`, `aceitar_convite_usuario`, `cancelar_convite_usuario`) — same pattern already used by `completar_cadastro_congregacao`. `aceitar_convite_usuario` branches internally between creating a brand-new `usuarios` row and transferring an existing one (moving `congregacao_id`/`perfil_id`), guarded by a "last active Coordenador" check. A new trigger (`usuarios_guard_autoalteracao`) blocks any user from changing their own `ativo`/`perfil_id` outside that RPC, and a column-level `GRANT` closes a pre-existing gap where nothing stopped `UPDATE usuarios SET id = ...`. Two new screens (`usuarios.tsx` inside the authenticated app, `aceitar-convite.tsx` as an always-reachable top-level route) plus two new hooks follow the exact patterns already used by `congregacao.tsx`/`use-congregacao.ts` and `completar-cadastro.tsx`.

**Tech Stack:** Supabase (Postgres migration + RLS, already provisioned), `@supabase/supabase-js`, Expo Router (`Stack.Protected` guards + `useLocalSearchParams`), `expo-linking` (already a dependency, no new package), NativeWind, `react-native-element-dropdown` (already a dependency), no automated test framework (verification is manual).

**Spec:** `frontend/docs/superpowers/specs/2026-08-17-gerenciar-usuarios-congregacao-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*`.
- Supabase project: `imeoyetcbjlkrxubwldv`. The migration is applied directly to this **live** project via the `apply_migration` MCP tool — there is no local Supabase stack and no staging environment. Double-check SQL before applying.
- No new npm dependencies (`expo-linking` is already in `package.json`).
- **No Edge Function, no real e-mail.** This was an explicit, deliberate decision (see spec's "Contexto") — do not reintroduce `inviteUserByEmail`/`service_role` anywhere in this feature.
- **No new RPCs beyond the three named in the spec** for simple perfil/status toggles (`atualizarPerfil`/`alternarAtivo` go through direct `UPDATE`, protected by the column-level `GRANT` from Task 1) — this matches `ADR-009`, which reserves RPCs for privileged/atomic multi-table operations.
- Error copy (verbatim, per spec):
  - Código de convite inválido/não encontrado: `"Código de convite inválido. Confira e tente novamente."`
  - Perfil informado não existe: `"Não foi possível encontrar esse perfil. Tente novamente."`
  - Código expirado: `"Esse convite expirou. Peça um novo código."`
  - Convidar sem permissão: `"Você não tem permissão para convidar usuários."`
  - Atribuir perfil Administrador Global sem ser Administrador Global: `"Apenas o Administrador Global pode atribuir esse perfil."`
  - Transferência com único Coordenador ativo: `"Você é o único Coordenador da sua congregação atual. Atribua o cargo a outro usuário antes de aceitar este convite."`
  - Falha genérica: `"Não foi possível concluir a operação. Tente novamente."`
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, matching `src/app/(app)/congregacao.tsx` and `src/app/completar-cadastro.tsx` (light/dark via `dark:` variants). Reuse `useTheme()` (`@/hooks/use-theme`) for `Dropdown` colors, exactly as `estado-cidade-picker.tsx` does.
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every frontend task before committing.
- `AGENTS.md` in `frontend/` warns that Expo has changed recently — if a step involving `Stack.Protected`/`Stack.Screen` behaves unexpectedly, check `https://docs.expo.dev/versions/v57.0.0/` before improvising a workaround.

---

### Task 1: Database — `convites_usuario`, guard trigger, column grant, RPCs, RLS fix

**Files:**
- Create: `database/migrations/20260817120000_gerenciar_usuarios_congregacao.sql`
- Modify: `docs/04-Regras-de-Negocio.md` (new RN-027, RN-028)
- Modify: `docs/09-Dicionario-de-Dados.md` (new section 15, `convites_usuario`)

**Interfaces:**
- Produces:
  - Table `public.convites_usuario` (`id`, `congregacao_id`, `perfil_id`, `codigo` unique, `rotulo`, `status` check `Pendente|Aceito|Cancelado|Expirado`, `criado_por`, `expira_em`, `aceito_por`, `aceito_em`, `cancelado_em`, `criado_em`), RLS enabled with only a `select` policy (no insert/update policy — all writes via RPC).
  - RPC `public.criar_convite_usuario(p_perfil_id uuid, p_rotulo varchar default null) returns table(id uuid, codigo varchar, expira_em timestamptz)`, called via `supabase.rpc('criar_convite_usuario', { p_perfil_id, p_rotulo })` in Task 5.
  - RPC `public.aceitar_convite_usuario(p_codigo varchar, p_nome varchar, p_sobrenome varchar, p_telefone varchar) returns table(usuario_id uuid, congregacao_id uuid)`, called via `supabase.rpc('aceitar_convite_usuario', {...})` in Task 2.
  - RPC `public.cancelar_convite_usuario(p_convite_id uuid) returns void`, called via `supabase.rpc('cancelar_convite_usuario', { p_convite_id })` in Task 5.
  - Exception message substrings other tasks match on: `não autenticado`, `sem_permissao`, `perfil_invalido`, `sem_permissao_perfil_admin`, `convite_invalido`, `convite_expirado`, `unico_coordenador`.
  - `public.usuarios` UPDATE is now column-restricted for role `authenticated` to exactly `(nome, sobrenome, telefone, perfil_id, ativo)` — Task 4's `atualizarPerfil`/`alternarAtivo` rely on this still permitting `perfil_id`/`ativo` writes for a manager editing someone else's row.
  - Trigger `usuarios_guard_autoalteracao` blocks a user from changing their own `ativo`/`perfil_id` unless `sipd.bypass_self_guard` is set locally — only Task 1's own `aceitar_convite_usuario` sets it.
  - `historicos_select` policy now also allows reading rows where `historicos.usuario_id` belongs to the caller's own congregação (previously only `programacao_id`-linked rows were visible).

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the `apply_migration` MCP tool (`project_id: imeoyetcbjlkrxubwldv`, `name: gerenciar_usuarios_congregacao`) with this SQL:

```sql
-- ----------------------------------------------------------------------------
-- 1. Tabela convites_usuario
-- ----------------------------------------------------------------------------
create table public.convites_usuario (
  id              uuid primary key default gen_random_uuid(),
  congregacao_id  uuid not null references public.congregacoes (id),
  perfil_id       uuid not null references public.perfis (id),
  codigo          varchar not null,
  rotulo          varchar,
  status          varchar not null default 'Pendente'
    constraint convites_usuario_status_check
    check (status in ('Pendente', 'Aceito', 'Cancelado', 'Expirado')),
  criado_por      uuid not null references public.usuarios (id),
  expira_em       timestamptz not null,
  aceito_por      uuid references public.usuarios (id),
  aceito_em       timestamptz,
  cancelado_em    timestamptz,
  criado_em       timestamptz not null default now(),
  constraint convites_usuario_codigo_key unique (codigo)
);

create index convites_usuario_congregacao_id_idx on public.convites_usuario (congregacao_id);

alter table public.convites_usuario enable row level security;

create policy convites_usuario_select on public.convites_usuario
  for select to authenticated
  using (
    public.is_administrador_global()
    or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id())
  );

-- Sem policy de INSERT nem UPDATE — criação e cancelamento só acontecem
-- via RPC security definer (seção 4).

-- ----------------------------------------------------------------------------
-- 2. Trigger de autoproteção em usuarios (RN-027)
-- usuarios_self_update permitia editar qualquer coluna da própria linha,
-- inclusive ativo/perfil_id.
-- ----------------------------------------------------------------------------
create or replace function public.usuarios_guard_autoalteracao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
     and coalesce(current_setting('sipd.bypass_self_guard', true), 'off') <> 'on'
     and (new.ativo is distinct from old.ativo or new.perfil_id is distinct from old.perfil_id) then
    raise exception 'não é permitido alterar seu próprio status ou perfil';
  end if;
  return new;
end;
$$;

create trigger usuarios_guard_autoalteracao before update on public.usuarios
  for each row execute function public.usuarios_guard_autoalteracao();

-- ----------------------------------------------------------------------------
-- 3. Trava de colunas em usuarios
-- Nada impedia um UPDATE usuarios SET id = <uuid de outro auth.users>,
-- sequestrando a identidade de outro usuário autenticado (id é FK para
-- auth.users, sem trava de coluna). RLS não resolve sozinha (não há como
-- comparar OLD/NEW numa única cláusula USING/WITH CHECK); GRANT restrito
-- a nível de coluna é aplicado pelo Postgres antes mesmo de avaliar RLS.
-- ----------------------------------------------------------------------------
revoke update on public.usuarios from authenticated;
grant update (nome, sobrenome, telefone, perfil_id, ativo) on public.usuarios to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPCs
-- ----------------------------------------------------------------------------
create or replace function public.gerar_codigo_convite()
returns varchar
language plpgsql
as $$
declare
  v_alfabeto varchar := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo varchar := '';
begin
  for i in 1..8 loop
    v_codigo := v_codigo || substr(v_alfabeto, (floor(random() * length(v_alfabeto)) + 1)::int, 1);
  end loop;
  return v_codigo;
end;
$$;

create or replace function public.criar_convite_usuario(
  p_perfil_id uuid,
  p_rotulo varchar default null
) returns table(id uuid, codigo varchar, expira_em timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_perfil_nome varchar;
  v_congregacao_id uuid;
  v_codigo varchar;
  v_id uuid;
  v_expira timestamptz := now() + interval '7 days';
  v_tentativas int := 0;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  if not (public.is_administrador_global() or public.is_coordenador()) then
    raise exception 'sem_permissao';
  end if;

  select nome into v_perfil_nome from public.perfis where id = p_perfil_id;
  if v_perfil_nome is null then
    raise exception 'perfil_invalido';
  end if;
  if v_perfil_nome = 'Administrador Global' and not public.is_administrador_global() then
    raise exception 'sem_permissao_perfil_admin';
  end if;

  v_congregacao_id := public.current_usuario_congregacao_id();

  loop
    v_codigo := public.gerar_codigo_convite();
    begin
      insert into public.convites_usuario (congregacao_id, perfil_id, codigo, rotulo, criado_por, expira_em)
      values (v_congregacao_id, p_perfil_id, v_codigo, p_rotulo, v_uid, v_expira)
      returning convites_usuario.id into v_id;
      exit;
    exception when unique_violation then
      v_tentativas := v_tentativas + 1;
      if v_tentativas >= 5 then
        raise exception 'falha_gerar_codigo';
      end if;
    end;
  end loop;

  insert into public.historicos (usuario_id, tipo, descricao, dados)
  values (
    null, 'convite_usuario_criado', 'Convite de usuário criado',
    jsonb_build_object('convite_id', v_id, 'congregacao_id', v_congregacao_id, 'perfil_id', p_perfil_id, 'criado_por', v_uid)
  );

  return query select v_id, v_codigo, v_expira;
end;
$$;

revoke execute on function public.criar_convite_usuario(uuid, varchar) from public;
grant execute on function public.criar_convite_usuario(uuid, varchar) to authenticated;

create or replace function public.aceitar_convite_usuario(
  p_codigo varchar,
  p_nome varchar,
  p_sobrenome varchar,
  p_telefone varchar
) returns table(usuario_id uuid, congregacao_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_convite record;
  v_email varchar;
  v_usuario_existente record;
  v_perfil_atual_nome varchar;
  v_outros_coordenadores int;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  select * into v_convite from public.convites_usuario where codigo = p_codigo for update;
  if v_convite.id is null or v_convite.status <> 'Pendente' then
    raise exception 'convite_invalido';
  end if;
  if v_convite.expira_em < now() then
    update public.convites_usuario set status = 'Expirado' where id = v_convite.id;
    raise exception 'convite_expirado';
  end if;

  select * into v_usuario_existente from public.usuarios where id = v_uid;

  if v_usuario_existente.id is not null then
    -- transferência
    select p.nome into v_perfil_atual_nome from public.perfis p where p.id = v_usuario_existente.perfil_id;

    if v_perfil_atual_nome = 'Coordenador' then
      select count(*) into v_outros_coordenadores
      from public.usuarios u
      join public.perfis p on p.id = u.perfil_id
      where u.congregacao_id = v_usuario_existente.congregacao_id
        and p.nome = 'Coordenador'
        and u.ativo = true
        and u.id <> v_uid;

      if v_outros_coordenadores = 0 then
        raise exception 'unico_coordenador';
      end if;
    end if;

    perform set_config('sipd.bypass_self_guard', 'on', true);

    update public.usuarios
    set congregacao_id = v_convite.congregacao_id,
        perfil_id = v_convite.perfil_id,
        nome = p_nome,
        sobrenome = p_sobrenome,
        telefone = p_telefone,
        ativo = true
    where id = v_uid;

    insert into public.historicos (usuario_id, tipo, descricao, dados)
    values (
      v_uid, 'usuario_transferido', 'Usuário transferido de congregação via convite',
      jsonb_build_object(
        'convite_id', v_convite.id,
        'congregacao_anterior_id', v_usuario_existente.congregacao_id,
        'perfil_anterior_id', v_usuario_existente.perfil_id,
        'congregacao_nova_id', v_convite.congregacao_id,
        'perfil_novo_id', v_convite.perfil_id
      )
    );
  else
    select email into v_email from auth.users where id = v_uid;

    insert into public.usuarios (id, congregacao_id, perfil_id, nome, sobrenome, email, telefone)
    values (v_uid, v_convite.congregacao_id, v_convite.perfil_id, p_nome, p_sobrenome, v_email, p_telefone);

    insert into public.historicos (usuario_id, tipo, descricao, dados)
    values (
      v_uid, 'usuario_criado_via_convite', 'Usuário criado via convite',
      jsonb_build_object('convite_id', v_convite.id, 'congregacao_id', v_convite.congregacao_id, 'perfil_id', v_convite.perfil_id)
    );
  end if;

  update public.convites_usuario
  set status = 'Aceito', aceito_por = v_uid, aceito_em = now()
  where id = v_convite.id;

  return query select v_uid, v_convite.congregacao_id;
end;
$$;

revoke execute on function public.aceitar_convite_usuario(varchar, varchar, varchar, varchar) from public;
grant execute on function public.aceitar_convite_usuario(varchar, varchar, varchar, varchar) to authenticated;

create or replace function public.cancelar_convite_usuario(
  p_convite_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_convite record;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  select * into v_convite from public.convites_usuario where id = p_convite_id for update;
  if v_convite.id is null then
    raise exception 'convite_invalido';
  end if;

  if not (
    public.is_administrador_global()
    or (public.is_coordenador() and v_convite.congregacao_id = public.current_usuario_congregacao_id())
  ) then
    raise exception 'sem_permissao';
  end if;

  if v_convite.status <> 'Pendente' then
    raise exception 'convite_invalido';
  end if;

  update public.convites_usuario
  set status = 'Cancelado', cancelado_em = now()
  where id = p_convite_id;

  insert into public.historicos (usuario_id, tipo, descricao, dados)
  values (
    null, 'convite_usuario_cancelado', 'Convite de usuário cancelado',
    jsonb_build_object('convite_id', p_convite_id, 'cancelado_por', v_uid)
  );
end;
$$;

revoke execute on function public.cancelar_convite_usuario(uuid) from public;
grant execute on function public.cancelar_convite_usuario(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Ajuste em historicos_select
-- Hoje só liberava leitura vinculada a programacao_id; Coordenador não
-- conseguia ver histórico de ações sobre usuários da própria congregação.
-- ----------------------------------------------------------------------------
drop policy historicos_select on public.historicos;

create policy historicos_select on public.historicos
  for select to authenticated
  using (
    public.is_administrador_global()
    or exists (
      select 1 from public.programacoes p
      where p.id = historicos.programacao_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
    or exists (
      select 1 from public.usuarios u
      where u.id = historicos.usuario_id
        and u.congregacao_id = public.current_usuario_congregacao_id()
    )
  );
```

Expected: tool reports success.

- [ ] **Step 2: Verify the new objects exist**

Run (via `execute_sql` MCP tool, `project_id: imeoyetcbjlkrxubwldv`):

```sql
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'convites_usuario';

select proname from pg_proc where proname in ('gerar_codigo_convite', 'criar_convite_usuario', 'aceitar_convite_usuario', 'cancelar_convite_usuario', 'usuarios_guard_autoalteracao') order by proname;

select tgname from pg_trigger where tgname = 'usuarios_guard_autoalteracao';

select policyname from pg_policies where tablename = 'convites_usuario' order by policyname;

select column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'usuarios' and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
```

Expected:
- First query: one row (`convites_usuario`).
- Second query: five rows (`aceitar_convite_usuario`, `cancelar_convite_usuario`, `criar_convite_usuario`, `gerar_codigo_convite`, `usuarios_guard_autoalteracao`).
- Third query: one row (`usuarios_guard_autoalteracao`).
- Fourth query: exactly one row (`convites_usuario_select`) — confirms no stray insert/update policy exists.
- Fifth query: exactly five rows (`ativo`, `nome`, `perfil_id`, `sobrenome`, `telefone`) — confirms `id`, `congregacao_id`, `email`, `criado_em`, `atualizado_em` are NOT updatable by `authenticated`.

- [ ] **Step 3: Save the migration as a local file**

Create `database/migrations/20260817120000_gerenciar_usuarios_congregacao.sql` with a header comment (mirroring existing migration files) followed by the exact SQL from Step 1:

```sql
-- ============================================================================
-- SIPD — Migração: Gerenciar Usuários da Congregação (UC-CGR-003)
-- ============================================================================
--
-- Contexto:
-- Convite de usuário por código/link (RPC security definer), sem Edge
-- Function/e-mail real — projeto sem fins lucrativos, sem domínio próprio
-- para autenticar SMTP (ver docs/13-ADR.md, ADR-010). O mesmo mecanismo
-- de convite cobre criação de conta nova e transferência de congregação
-- para quem já tem cadastro.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-17-gerenciar-usuarios-congregacao-design.md
-- ============================================================================

<same SQL as Step 1>
```

- [ ] **Step 4: Update `docs/04-Regras-de-Negocio.md` — RN-027 and RN-028**

Find:

```markdown
### RN-026

Toda congregação criada por autoatendimento deve ter, no momento da criação, um usuário vinculado com perfil Coordenador.

---

# Oradores
```

Replace with:

```markdown
### RN-026

Toda congregação criada por autoatendimento deve ter, no momento da criação, um usuário vinculado com perfil Coordenador.

---

### RN-027

Um usuário não pode alterar o próprio status de ativo/inativo nem o próprio perfil. Apenas outro usuário com permissão de gerenciamento (Coordenador da congregação ou Administrador Global) pode fazer essas alterações.

---

### RN-028

Um usuário que seja o único Coordenador ativo de sua congregação não pode ser transferido para outra congregação antes que outro usuário assuma o perfil de Coordenador na congregação de origem.

---

# Oradores
```

- [ ] **Step 5: Update `docs/09-Dicionario-de-Dados.md` — new section 15**

Find:

```markdown
### Chave estrangeira

`usuario_id` → `usuarios.id`

---

# Índices e Restrições de Unicidade
```

Replace with:

```markdown
### Chave estrangeira

`usuario_id` → `usuarios.id`

---

## 15. Convites de Usuário

**Tabela:** `convites_usuario`

### Finalidade

Representa um convite de código/link para um usuário se vincular (ou se transferir) a uma congregação, com o perfil definido no convite.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do convite |
| congregacao_id | UUID | Sim | Não | Sim | Não | Congregação de destino |
| perfil_id | UUID | Sim | Não | Sim | Não | Perfil atribuído ao aceitar |
| codigo | VARCHAR | Sim | Não | Não | Sim | Código de 8 caracteres compartilhado manualmente |
| rotulo | VARCHAR | Não | Não | Não | Não | Anotação livre de quem convidou |
| status | VARCHAR | Sim | Não | Não | Não | Estado atual do convite |
| criado_por | UUID | Sim | Não | Sim | Não | Usuário que criou o convite |
| expira_em | TIMESTAMP | Sim | Não | Não | Não | Validade do convite (7 dias após criação) |
| aceito_por | UUID | Não | Não | Sim | Não | Usuário que aceitou o convite |
| aceito_em | TIMESTAMP | Não | Não | Não | Não | Data da aceitação |
| cancelado_em | TIMESTAMP | Não | Não | Não | Não | Data do cancelamento |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |

### Chaves estrangeiras

- `congregacao_id` → `congregacoes.id`
- `perfil_id` → `perfis.id`
- `criado_por` → `usuarios.id`
- `aceito_por` → `usuarios.id`

### Estados

- Pendente
- Aceito
- Cancelado
- Expirado

---

# Índices e Restrições de Unicidade
```

- [ ] **Step 6: Commit**

```bash
git add database/migrations/20260817120000_gerenciar_usuarios_congregacao.sql docs/04-Regras-de-Negocio.md docs/09-Dicionario-de-Dados.md
git commit -m "feat(congregacoes): add convites_usuario table, self-guard trigger, and invite RPCs"
```

---

### Task 2: `AuthProvider` — `aceitarConvite`

**Files:**
- Modify: `frontend/src/features/administracao/auth-provider.tsx`

**Interfaces:**
- Consumes: `public.aceitar_convite_usuario` RPC from Task 1.
- Produces (used by Task 7): `aceitarConvite(codigo: string, nome: string, sobrenome: string, telefone: string): Promise<{ error: string | null }>` on `AuthContextValue`. Existing `status`/`usuario`/`signIn`/`signUp`/`completarCadastro`/`signOut` keep their current shape.

- [ ] **Step 1: Replace the full contents of `auth-provider.tsx`**

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type Perfil = {
  id: string;
  nome: string;
  descricao: string | null;
};

export type Usuario = {
  id: string;
  congregacao_id: string;
  perfil_id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  perfil: Perfil;
};

export type AuthStatus = 'loading' | 'authenticated' | 'onboarding' | 'unauthenticated';

export type CompletarCadastroInput = {
  nomeCongregacao: string;
  numero: string;
  cidadeId: string;
  nomeUsuario: string;
  sobrenomeUsuario: string;
  telefone: string;
};

export type AuthContextValue = {
  status: AuthStatus;
  usuario: Usuario | null;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signUp: (email: string, senha: string) => Promise<{ error: string | null }>;
  completarCadastro: (input: CompletarCadastroInput) => Promise<{ error: string | null }>;
  aceitarConvite: (
    codigo: string,
    nome: string,
    sobrenome: string,
    telefone: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_AUTH_ERROR = 'Não foi possível autenticar. Verifique seu e-mail e senha.';
const NETWORK_ERROR = 'Não foi possível concluir a autenticação no momento. Tente novamente.';
const ERRO_EMAIL_EM_USO = 'Esse e-mail já está em uso. Tente entrar na sua conta.';
const ERRO_SENHA_CURTA = 'A senha precisa ter pelo menos 6 caracteres.';
const ERRO_SIGNUP_GENERICO = 'Não foi possível criar a conta. Tente novamente.';
const ERRO_NUMERO_DUPLICADO =
  'Já existe uma congregação com esse número. Peça para o Coordenador dela te convidar.';
const ERRO_CADASTRO_GENERICO = 'Não foi possível concluir o cadastro. Tente novamente.';
const ERRO_CONVITE_INVALIDO = 'Código de convite inválido. Confira e tente novamente.';
const ERRO_CONVITE_EXPIRADO = 'Esse convite expirou. Peça um novo código.';
const ERRO_UNICO_COORDENADOR =
  'Você é o único Coordenador da sua congregação atual. Atribua o cargo a outro usuário antes de aceitar este convite.';
const ERRO_CONVITE_GENERICO = 'Não foi possível concluir a operação. Tente novamente.';

async function fetchUsuario(userId: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, congregacao_id, perfil_id, nome, sobrenome, email, telefone, ativo, perfil:perfis(id, nome, descricao)')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as unknown as Usuario;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function syncFromSession(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
        return;
      }

      const nextUsuario = await fetchUsuario(session.user.id);
      if (cancelled) return;

      if (nextUsuario && !nextUsuario.ativo) {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
        return;
      }

      if (!nextUsuario) {
        // Sessão válida, mas sem linha em `usuarios` ainda — conta recém-criada
        // via signUp, aguardando o fluxo de Completar Cadastro (ou Aceitar Convite).
        setUsuario(null);
        setStatus('onboarding');
        return;
      }

      setUsuario(nextUsuario);
      setStatus('authenticated');
    }

    supabase.auth.getSession().then(({ data }) => syncFromSession(data.session));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, senha: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error || !data.session) return { error: GENERIC_AUTH_ERROR };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (nextUsuario && !nextUsuario.ativo) {
        await supabase.auth.signOut();
        return { error: GENERIC_AUTH_ERROR };
      }

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signUp(email: string, senha: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered')) return { error: ERRO_EMAIL_EM_USO };
        if (msg.includes('password')) return { error: ERRO_SENHA_CURTA };
        return { error: ERRO_SIGNUP_GENERICO };
      }
      if (!data.session) return { error: ERRO_SIGNUP_GENERICO };

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function completarCadastro(input: CompletarCadastroInput): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('completar_cadastro_congregacao', {
        p_nome_congregacao: input.nomeCongregacao,
        p_numero: input.numero,
        p_cidade_id: input.cidadeId,
        p_nome_usuario: input.nomeUsuario,
        p_sobrenome_usuario: input.sobrenomeUsuario,
        p_telefone: input.telefone,
      });

      if (error) {
        if (error.message.includes('numero_duplicado')) {
          return { error: ERRO_NUMERO_DUPLICADO };
        }
        if (!error.message.includes('usuário já possui cadastro completo')) {
          return { error: ERRO_CADASTRO_GENERICO };
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) return { error: ERRO_CADASTRO_GENERICO };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario) return { error: ERRO_CADASTRO_GENERICO };

      setUsuario(nextUsuario);
      setStatus('authenticated');
      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function aceitarConvite(
    codigo: string,
    nome: string,
    sobrenome: string,
    telefone: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('aceitar_convite_usuario', {
        p_codigo: codigo,
        p_nome: nome,
        p_sobrenome: sobrenome,
        p_telefone: telefone,
      });

      if (error) {
        if (error.message.includes('convite_expirado')) return { error: ERRO_CONVITE_EXPIRADO };
        if (error.message.includes('convite_invalido')) return { error: ERRO_CONVITE_INVALIDO };
        if (error.message.includes('unico_coordenador')) return { error: ERRO_UNICO_COORDENADOR };
        return { error: ERRO_CONVITE_GENERICO };
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) return { error: ERRO_CONVITE_GENERICO };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario) return { error: ERRO_CONVITE_GENERICO };

      setUsuario(nextUsuario);
      setStatus('authenticated');
      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ status, usuario, signIn, signUp, completarCadastro, aceitarConvite, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/administracao/auth-provider.tsx
git commit -m "feat(administracao): add aceitarConvite to AuthProvider"
```

---

### Task 3: Routing — always-reachable `aceitar-convite` route

**Files:**
- Modify: `frontend/src/app/_layout.tsx`

**Interfaces:**
- Assumes route file `aceitar-convite.tsx` (Task 7) will exist — same lazy-resolution reasoning as the existing `completar-cadastro`/`signup` entries; this task can be committed before that file exists without breaking currently-working routes.

- [ ] **Step 1: Add an unguarded `Stack.Screen` for `aceitar-convite`**

In `frontend/src/app/_layout.tsx`, replace:

```tsx
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'onboarding'}>
        <Stack.Screen name="completar-cadastro" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
    </Stack>
  );
```

with:

```tsx
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'onboarding'}>
        <Stack.Screen name="completar-cadastro" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
      {/* Sempre alcançável, independente do status — a própria tela decide
          o que renderizar por status (ver aceitar-convite.tsx). Precisa
          disso porque um convite de transferência é aceito por alguém já
          'authenticated', e um convite de conta nova por alguém em
          'onboarding' ou 'unauthenticated'. */}
      <Stack.Screen name="aceitar-convite" />
    </Stack>
  );
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors (route names are plain strings, not statically checked).

- [ ] **Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(administracao): add always-reachable aceitar-convite route"
```

---

### Task 4: `use-usuarios-congregacao` hook

**Files:**
- Create: `frontend/src/features/congregacoes/use-usuarios-congregacao.ts`

**Interfaces:**
- Consumes: `useAuth()` (`usuario.congregacao_id`), `supabase` from `@/lib/supabase`.
- Produces (used by Task 6):
  ```ts
  export type Perfil = { id: string; nome: string };
  export type UsuarioCongregacao = {
    id: string; nome: string; sobrenome: string; email: string;
    telefone: string | null; ativo: boolean; perfil_id: string; perfil: Perfil;
  };
  export type UsuariosCongregacaoStatus = 'loading' | 'ready' | 'error';
  function useUsuariosCongregacao(): {
    status: UsuariosCongregacaoStatus;
    usuarios: UsuarioCongregacao[];
    perfis: Perfil[];
    atualizarPerfil: (alvo: UsuarioCongregacao, perfilId: string) => Promise<{ error: string | null }>;
    alternarAtivo: (alvo: UsuarioCongregacao, ativo: boolean) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/congregacoes/use-usuarios-congregacao.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Perfil = {
  id: string;
  nome: string;
};

export type UsuarioCongregacao = {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  perfil_id: string;
  perfil: Perfil;
};

export type UsuariosCongregacaoStatus = 'loading' | 'ready' | 'error';

const USUARIOS_SELECT = 'id, nome, sobrenome, email, telefone, ativo, perfil_id, perfil:perfis(id, nome)';
const ERRO_ATUALIZAR = 'Não foi possível salvar a alteração. Tente novamente.';

export function useUsuariosCongregacao() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioCongregacao[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [status, setStatus] = useState<UsuariosCongregacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const [usuariosResult, perfisResult] = await Promise.all([
      supabase
        .from('usuarios')
        .select(USUARIOS_SELECT)
        .eq('congregacao_id', usuario.congregacao_id)
        .order('nome'),
      supabase.from('perfis').select('id, nome').order('nome'),
    ]);

    if (usuariosResult.error || perfisResult.error) {
      setStatus('error');
      return;
    }

    setUsuarios((usuariosResult.data ?? []) as unknown as UsuarioCongregacao[]);
    setPerfis((perfisResult.data ?? []) as Perfil[]);
    setStatus('ready');
  }, [usuario?.congregacao_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizarPerfil(alvo: UsuarioCongregacao, perfilId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('usuarios').update({ perfil_id: perfilId }).eq('id', alvo.id);
    if (error) return { error: ERRO_ATUALIZAR };

    await supabase.from('historicos').insert({
      usuario_id: alvo.id,
      tipo: 'usuario_perfil_alterado',
      descricao: 'Perfil do usuário alterado',
      dados: { perfil_anterior_id: alvo.perfil_id, perfil_novo_id: perfilId },
    });

    await carregar();
    return { error: null };
  }

  async function alternarAtivo(alvo: UsuarioCongregacao, ativo: boolean): Promise<{ error: string | null }> {
    const { error } = await supabase.from('usuarios').update({ ativo }).eq('id', alvo.id);
    if (error) return { error: ERRO_ATUALIZAR };

    await supabase.from('historicos').insert({
      usuario_id: alvo.id,
      tipo: ativo ? 'usuario_ativado' : 'usuario_desativado',
      descricao: ativo ? 'Usuário ativado' : 'Usuário desativado',
      dados: { ativo_anterior: alvo.ativo, ativo_novo: ativo },
    });

    await carregar();
    return { error: null };
  }

  return { status, usuarios, perfis, atualizarPerfil, alternarAtivo };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/congregacoes/use-usuarios-congregacao.ts
git commit -m "feat(congregacoes): add use-usuarios-congregacao hook"
```

---

### Task 5: `use-convites-usuario` hook

**Files:**
- Create: `frontend/src/features/congregacoes/use-convites-usuario.ts`

**Interfaces:**
- Consumes: `criar_convite_usuario` and `cancelar_convite_usuario` RPCs from Task 1.
- Produces (used by Task 6):
  ```ts
  export type ConviteUsuario = {
    id: string; perfil_id: string; codigo: string; rotulo: string | null;
    expira_em: string; perfil: { id: string; nome: string };
  };
  export type ConvitesUsuarioStatus = 'loading' | 'ready' | 'error';
  function useConvitesUsuario(): {
    status: ConvitesUsuarioStatus;
    convites: ConviteUsuario[];
    criarConvite: (perfilId: string, rotulo: string) => Promise<{ codigo: string | null; error: string | null }>;
    cancelarConvite: (id: string) => Promise<{ error: string | null }>;
  }
  ```

- [ ] **Step 1: Create `frontend/src/features/congregacoes/use-convites-usuario.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type ConviteUsuario = {
  id: string;
  perfil_id: string;
  codigo: string;
  rotulo: string | null;
  expira_em: string;
  perfil: { id: string; nome: string };
};

export type ConvitesUsuarioStatus = 'loading' | 'ready' | 'error';

const CONVITES_SELECT = 'id, perfil_id, codigo, rotulo, expira_em, perfil:perfis(id, nome)';
const ERRO_CRIAR_CONVITE = 'Não foi possível criar o convite. Tente novamente.';
const ERRO_CANCELAR_CONVITE = 'Não foi possível cancelar o convite. Tente novamente.';
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para convidar usuários.';
const ERRO_PERFIL_ADMIN = 'Apenas o Administrador Global pode atribuir esse perfil.';
const ERRO_PERFIL_INVALIDO = 'Não foi possível encontrar esse perfil. Tente novamente.';

export function useConvitesUsuario() {
  const { usuario } = useAuth();
  const [convites, setConvites] = useState<ConviteUsuario[]>([]);
  const [status, setStatus] = useState<ConvitesUsuarioStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('convites_usuario')
      .select(CONVITES_SELECT)
      .eq('status', 'Pendente')
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setConvites((data ?? []) as unknown as ConviteUsuario[]);
    setStatus('ready');
  }, [usuario?.congregacao_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarConvite(perfilId: string, rotulo: string): Promise<{ codigo: string | null; error: string | null }> {
    const { data, error } = await supabase.rpc('criar_convite_usuario', {
      p_perfil_id: perfilId,
      p_rotulo: rotulo || null,
    });

    if (error) {
      if (error.message.includes('sem_permissao_perfil_admin')) return { codigo: null, error: ERRO_PERFIL_ADMIN };
      if (error.message.includes('sem_permissao')) return { codigo: null, error: ERRO_SEM_PERMISSAO };
      if (error.message.includes('perfil_invalido')) return { codigo: null, error: ERRO_PERFIL_INVALIDO };
      return { codigo: null, error: ERRO_CRIAR_CONVITE };
    }
    if (!data || !data[0]) return { codigo: null, error: ERRO_CRIAR_CONVITE };

    await carregar();
    return { codigo: (data[0] as { codigo: string }).codigo, error: null };
  }

  async function cancelarConvite(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('cancelar_convite_usuario', { p_convite_id: id });
    if (error) return { error: ERRO_CANCELAR_CONVITE };

    await carregar();
    return { error: null };
  }

  return { status, convites, criarConvite, cancelarConvite };
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/congregacoes/use-convites-usuario.ts
git commit -m "feat(congregacoes): add use-convites-usuario hook"
```

---

### Task 6: `usuarios.tsx` screen and tab entry

**Files:**
- Create: `frontend/src/app/(app)/usuarios.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`

**Interfaces:**
- Consumes: `useUsuariosCongregacao` (Task 4), `useConvitesUsuario` (Task 5), `useAuth()`, `useTheme()`, `expo-linking`'s `createURL`.

- [ ] **Step 1: Create `frontend/src/app/(app)/usuarios.tsx`**

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import * as Linking from 'expo-linking';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUsuariosCongregacao, type UsuarioCongregacao } from '@/features/congregacoes/use-usuarios-congregacao';
import { useConvitesUsuario } from '@/features/congregacoes/use-convites-usuario';

const PODE_GERENCIAR = ['Coordenador', 'Administrador Global'];
const ERRO_PERFIL_CONVITE = 'Selecione o perfil do convite.';
const ERRO_CONVITE_GENERICO = 'Não foi possível criar o convite. Tente novamente.';

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function UsuariosScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status: statusUsuarios, usuarios, perfis, atualizarPerfil, alternarAtivo } = useUsuariosCongregacao();
  const { status: statusConvites, convites, criarConvite, cancelarConvite } = useConvitesUsuario();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarConvite, setMostrarConvite] = useState(false);
  const [perfilConviteId, setPerfilConviteId] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | null>(null);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';
  const perfisAtribuiveis = perfis.filter((p) => ehAdministradorGlobal || p.nome !== 'Administrador Global');

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  async function handleAlterarPerfil(alvo: UsuarioCongregacao, perfilId: string) {
    setErro(null);
    setSalvandoId(alvo.id);
    const { error } = await atualizarPerfil(alvo, perfilId);
    setSalvandoId(null);
    setEditandoId(null);
    if (error) setErro(error);
  }

  async function handleAlternarAtivo(alvo: UsuarioCongregacao) {
    setErro(null);
    setSalvandoId(alvo.id);
    const { error } = await alternarAtivo(alvo, !alvo.ativo);
    setSalvandoId(null);
    if (error) setErro(error);
  }

  async function handleCriarConvite() {
    setErroConvite(null);
    if (!perfilConviteId) {
      setErroConvite(ERRO_PERFIL_CONVITE);
      return;
    }

    setCriandoConvite(true);
    const { codigo, error } = await criarConvite(perfilConviteId, rotulo.trim());
    setCriandoConvite(false);

    if (error || !codigo) {
      setErroConvite(error ?? ERRO_CONVITE_GENERICO);
      return;
    }

    setCodigoGerado(codigo);
    setRotulo('');
    setPerfilConviteId('');
  }

  async function handleCompartilhar(codigo: string) {
    const link = Linking.createURL('/aceitar-convite', { queryParams: { codigo } });
    try {
      await Share.share({ message: `Convite para o SIPD: ${link}` });
    } catch {
      // Share pode não estar disponível (ex.: alguns navegadores no build
      // web) — o código já fica visível e selecionável na tela.
    }
  }

  async function handleCancelarConvite(id: string) {
    setCancelandoId(id);
    await cancelarConvite(id);
    setCancelandoId(null);
  }

  if (statusUsuarios === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (statusUsuarios === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os usuários da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Usuários</Text>

        {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

        {usuarios.map((u) => (
          <View key={u.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <Text className="text-base font-medium text-neutral-900 dark:text-white">
              {u.nome} {u.sobrenome}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</Text>

            {editandoId === u.id ? (
              <Dropdown
                style={dropdownStyle}
                containerStyle={{ backgroundColor: colors.background }}
                placeholderStyle={{ color: colors.textSecondary }}
                selectedTextStyle={{ color: colors.text }}
                itemTextStyle={{ color: colors.text }}
                activeColor={colors.backgroundSelected}
                data={perfisAtribuiveis.map((p) => ({ id: p.id, label: p.nome }))}
                labelField="label"
                valueField="id"
                value={u.perfil_id}
                placeholder="Selecionar perfil"
                onChange={(item) => handleAlterarPerfil(u, item.id)}
              />
            ) : (
              <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                {u.perfil.nome} · {u.ativo ? 'Ativo' : 'Inativo'}
              </Text>
            )}

            {podeGerenciar && u.id !== usuario?.id ? (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setEditandoId(editandoId === u.id ? null : u.id)}
                  disabled={salvandoId === u.id}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                    {editandoId === u.id ? 'Cancelar' : 'Editar perfil'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAlternarAtivo(u)}
                  disabled={salvandoId === u.id}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  {salvandoId === u.id ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        {podeGerenciar ? (
          <>
            <Text className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">Convites pendentes</Text>

            {statusConvites === 'ready' && convites.length === 0 ? (
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum convite pendente.</Text>
            ) : null}

            {convites.map((c) => (
              <View key={c.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {c.rotulo || 'Sem rótulo'} · {c.perfil.nome}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  Código: {c.codigo} · Válido até {formatarData(c.expira_em)}
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => handleCompartilhar(c.codigo)}
                    className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                    <Text className="text-sm font-medium text-neutral-900 dark:text-white">Compartilhar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCancelarConvite(c.id)}
                    disabled={cancelandoId === c.id}
                    className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                    {cancelandoId === c.id ? (
                      <ActivityIndicator />
                    ) : (
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}

            {mostrarConvite ? (
              <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Dropdown
                  style={dropdownStyle}
                  containerStyle={{ backgroundColor: colors.background }}
                  placeholderStyle={{ color: colors.textSecondary }}
                  selectedTextStyle={{ color: colors.text }}
                  itemTextStyle={{ color: colors.text }}
                  activeColor={colors.backgroundSelected}
                  data={perfisAtribuiveis.map((p) => ({ id: p.id, label: p.nome }))}
                  labelField="label"
                  valueField="id"
                  value={perfilConviteId}
                  placeholder="Selecionar perfil"
                  onChange={(item) => setPerfilConviteId(item.id)}
                />
                <TextInput
                  value={rotulo}
                  onChangeText={setRotulo}
                  placeholder="Rótulo (opcional, ex.: nome da pessoa)"
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                />

                {erroConvite ? <Text className="text-sm text-red-600 dark:text-red-400">{erroConvite}</Text> : null}

                {codigoGerado ? (
                  <View className="gap-2 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                    <Text selectable className="text-base font-bold text-neutral-900 dark:text-white">
                      {codigoGerado}
                    </Text>
                    <Pressable
                      onPress={() => handleCompartilhar(codigoGerado)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Compartilhar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleCriarConvite}
                    disabled={criandoConvite}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {criandoConvite ? (
                      <ActivityIndicator />
                    ) : (
                      <Text className="font-medium text-white dark:text-neutral-900">Gerar convite</Text>
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    setMostrarConvite(false);
                    setCodigoGerado(null);
                    setErroConvite(null);
                  }}
                  className="items-center py-2">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setMostrarConvite(true)}
                className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Convidar Usuário</Text>
              </Pressable>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Add the "Usuários" tab**

In `frontend/src/components/app-tabs.tsx`, replace:

```tsx
      <NativeTabs.Trigger name="congregacao">
        <NativeTabs.Trigger.Label>Congregação</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
```

with:

```tsx
      <NativeTabs.Trigger name="congregacao">
        <NativeTabs.Trigger.Label>Congregação</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="usuarios">
        <NativeTabs.Trigger.Label>Usuários</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/usuarios.tsx src/components/app-tabs.tsx
git commit -m "feat(congregacoes): add usuarios screen and tab"
```

---

### Task 7: `aceitar-convite.tsx` screen

**Files:**
- Create: `frontend/src/app/aceitar-convite.tsx`

**Interfaces:**
- Consumes: `aceitarConvite` from `useAuth()` (Task 2); `status`/`usuario` from `useAuth()`.

- [ ] **Step 1: Create `frontend/src/app/aceitar-convite.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';

const ERRO_CAMPOS = 'Preencha o código, nome, sobrenome e telefone.';

export default function AceitarConviteScreen() {
  const { status, usuario, aceitarConvite } = useAuth();
  const params = useLocalSearchParams<{ codigo?: string }>();

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (params.codigo) setCodigo(String(params.codigo).toUpperCase());
  }, [params.codigo]);

  useEffect(() => {
    if (status === 'authenticated' && usuario) {
      setNome(usuario.nome);
      setSobrenome(usuario.sobrenome);
      setTelefone(usuario.telefone ?? '');
    }
  }, [status, usuario]);

  async function handleSubmit() {
    setErro(null);
    if (!codigo.trim() || !nome.trim() || !sobrenome.trim() || !telefone.trim()) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setEnviando(true);
    const { error } = await aceitarConvite(codigo.trim().toUpperCase(), nome.trim(), sobrenome.trim(), telefone.trim());
    setEnviando(false);

    if (error) setErro(error);
  }

  if (status === 'unauthenticated') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <View className="w-full max-w-sm gap-3">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Você recebeu um convite</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Entre ou crie sua conta primeiro. Depois, abra este link de convite de novo para continuar.
          </Text>
          <Link
            href="/login"
            className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 text-center font-medium text-white dark:bg-white dark:text-neutral-900">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="items-center rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-medium text-neutral-900 dark:border-neutral-600 dark:text-white">
            Criar conta
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Aceitar Convite</Text>

        <TextInput
          value={codigo}
          onChangeText={(texto) => setCodigo(texto.toUpperCase())}
          placeholder="Código do convite"
          autoCapitalize="characters"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />
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
          placeholder="Telefone"
          keyboardType="phone-pad"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />

        {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={enviando}
          className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {enviando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Aceitar convite</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/aceitar-convite.tsx
git commit -m "feat(congregacoes): add aceitar-convite screen"
```

---

### Task 8: `completar-cadastro.tsx` — link to Aceitar Convite

**Files:**
- Modify: `frontend/src/app/completar-cadastro.tsx`

**Interfaces:** none new — links to the `aceitar-convite` route created in Task 7.

- [ ] **Step 1: Add the `Link` import**

In `frontend/src/app/completar-cadastro.tsx`, replace:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';
```

with:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';
```

- [ ] **Step 2: Add the link, visible only on Passo 1**

Replace:

```tsx
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {passo === 1 ? 'Passo 1 de 2 — Dados da congregação' : 'Passo 2 de 2 — Seus dados'}
        </Text>

        {passo === 1 ? (
```

with:

```tsx
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {passo === 1 ? 'Passo 1 de 2 — Dados da congregação' : 'Passo 2 de 2 — Seus dados'}
        </Text>

        {passo === 1 ? (
          <Link href="/aceitar-convite" className="text-sm text-neutral-500 underline dark:text-neutral-400">
            Tenho um código de convite
          </Link>
        ) : null}

        {passo === 1 ? (
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/completar-cadastro.tsx
git commit -m "feat(congregacoes): link completar-cadastro to aceitar-convite"
```

---

### Task 9: Documentation — UC-CGR-003, API mapping, ADR

**Files:**
- Modify: `docs/06.1.2 - Congregações.md`
- Modify: `docs/12-API.md`
- Modify: `docs/13-ADR.md`

**Interfaces:** none — narrative documentation only.

- [ ] **Step 1: Rewrite FA-02 and add FA-05 in `docs/06.1.2 - Congregações.md`**

Find:

```markdown
### FA-02 — Convite de novo usuário

1. O usuário autorizado seleciona Convidar Usuário.
2. Informa os dados necessários.
3. O sistema envia o convite.
4. O usuário convidado poderá criar ou vincular sua conta.
5. Após o processo de vinculação, o usuário passa a fazer parte da congregação.

### FA-03 — Alteração de perfil

O sistema permite alterar o perfil do usuário quando o operador possuir permissão para essa ação.

A atribuição do perfil Administrador Global permanece restrita ao Administrador Global.

### FA-04 — Desativação

1. O usuário autorizado seleciona um usuário.
2. Seleciona Desativar.
3. O sistema solicita confirmação.
4. O sistema desativa o usuário ou seu acesso conforme as regras de segurança.

## Fluxos de Exceção
```

Replace with:

```markdown
### FA-02 — Convite de novo usuário

1. O usuário autorizado seleciona Convidar Usuário.
2. Informa o perfil a ser atribuído (e, opcionalmente, um rótulo para identificar o convite).
3. O sistema gera um código/link de convite, válido por 7 dias.
4. O usuário autorizado compartilha o código/link manualmente com o convidado (ex.: WhatsApp).
5. O usuário convidado cria ou acessa sua conta e informa o código para vincular-se à congregação.
6. Após a vinculação, o usuário passa a fazer parte da congregação, com o perfil definido no convite.

### FA-03 — Alteração de perfil

O sistema permite alterar o perfil do usuário quando o operador possuir permissão para essa ação.

A atribuição do perfil Administrador Global permanece restrita ao Administrador Global.

### FA-04 — Desativação

1. O usuário autorizado seleciona um usuário.
2. Seleciona Desativar.
3. O sistema solicita confirmação.
4. O sistema desativa o usuário ou seu acesso conforme as regras de segurança.

### FA-05 — Transferência entre congregações

1. Um usuário que já possui cadastro em outra congregação recebe um convite de código/link de uma nova congregação.
2. Ao informar o código do convite, o sistema identifica que o usuário já possui cadastro.
3. O sistema substitui a congregação e o perfil do usuário pelos definidos no convite, e marca o usuário como ativo.

**Restrição:** se o usuário for o único Coordenador ativo da congregação de origem, a transferência é bloqueada até que outro usuário assuma o perfil de Coordenador ali (RN-028).

## Fluxos de Exceção
```

- [ ] **Step 2: Update Regras de Negócio Relacionadas, Entidades Envolvidas, APIs Relacionadas, and Telas Relacionadas**

Find:

```markdown
## Regras de Negócio Relacionadas

- RN-002
- RN-003
- RN-005
- RN-011
- RN-090
- RN-091
- RN-102

## Entidades Envolvidas

- Usuário
- Perfil
- Congregação
- Histórico

## Casos de Uso Relacionados

- UC-ADM-005 — Gerenciar Usuários
- UC-ADM-006 — Gerenciar Perfis
- UC-CGR-001 — Consultar Congregação
- UC-CGR-002 — Atualizar Dados da Congregação

## APIs Relacionadas

- GET /congregacoes/{id}/usuarios
- POST /congregacoes/{id}/usuarios
- PUT /usuarios/{id}
- PATCH /usuarios/{id}/status

## Telas Relacionadas

- Usuários da Congregação
- Convidar Usuário
- Editar Usuário
- Perfil do Usuário
```

Replace with:

```markdown
## Regras de Negócio Relacionadas

- RN-002
- RN-003
- RN-005
- RN-011
- RN-027
- RN-028
- RN-090
- RN-091
- RN-102

## Entidades Envolvidas

- Usuário
- Perfil
- Congregação
- Histórico
- Convite de Usuário

## Casos de Uso Relacionados

- UC-ADM-005 — Gerenciar Usuários
- UC-ADM-006 — Gerenciar Perfis
- UC-CGR-001 — Consultar Congregação
- UC-CGR-002 — Atualizar Dados da Congregação

## APIs Relacionadas

- GET /congregacoes/{id}/usuarios
- RPC criar_convite_usuario
- RPC aceitar_convite_usuario
- RPC cancelar_convite_usuario
- PUT /usuarios/{id}
- PATCH /usuarios/{id}/status

## Telas Relacionadas

- Usuários da Congregação
- Convidar Usuário
- Aceitar Convite
- Editar Usuário
- Perfil do Usuário
```

- [ ] **Step 3: Update the Matriz de Rastreabilidade row**

Find:

```markdown
| UC-CGR-003 | RN-002, RN-003, RN-005, RN-011, RN-090, RN-091, RN-102 | Usuário, Perfil, Congregação, Histórico | GET/POST/PUT/PATCH /congregacoes e /usuarios | Usuários da Congregação |
```

Replace with:

```markdown
| UC-CGR-003 | RN-002, RN-003, RN-005, RN-011, RN-027, RN-028, RN-090, RN-091, RN-102 | Usuário, Perfil, Congregação, Histórico, Convite de Usuário | GET /usuarios, RPCs criar/aceitar/cancelar_convite_usuario, PUT/PATCH /usuarios | Usuários da Congregação |
```

- [ ] **Step 4: Update `docs/12-API.md`**

Find:

```markdown
  | UC-CGR-003 | Gerenciar Usuários da Congregação | GET | `/rest/v1/usuarios?congregacao_id=eq.{id}` | Tabela direta | `usuarios` |
  | | | POST | `/functions/v1/convidar-usuario` | Edge Function² | `usuarios` + `auth.users` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` | Tabela direta | `usuarios` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` (campo `ativo`) | Tabela direta | `usuarios` |

  ² Convidar um novo usuário exige criar a credencial em `auth.users` via Supabase Auth Admin API, que só pode ser chamada com `service_role` — não é possível a partir do cliente, por isso é Edge Function, não uma escrita direta na tabela `usuarios`.
```

Replace with:

```markdown
  | UC-CGR-003 | Gerenciar Usuários da Congregação | GET | `/rest/v1/usuarios?congregacao_id=eq.{id}` | Tabela direta | `usuarios` |
  | | | POST | `rpc/criar_convite_usuario` | RPC² | `convites_usuario` |
  | | | POST | `rpc/aceitar_convite_usuario` | RPC² | `usuarios`, `convites_usuario` |
  | | | POST | `rpc/cancelar_convite_usuario` | RPC² | `convites_usuario` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` | Tabela direta | `usuarios` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` (campo `ativo`) | Tabela direta | `usuarios` |

  ² Convidar/aceitar/cancelar convite usam RPCs `security definer` (código/link compartilhado manualmente), não uma Edge Function com e-mail real — decisão registrada em `13-ADR.md`, ADR-010 (projeto sem fins lucrativos, sem domínio próprio para autenticar SMTP).
```

- [ ] **Step 5: Add ADR-010 to `docs/13-ADR.md`**

Find:

```markdown
- Positivo: a maioria das operações (CRUD simples) tem latência menor, por não passar por uma camada de execução adicional.
- Positivo: o uso de `service_role` fica concentrado em um pequeno conjunto de Edge Functions auditáveis, em vez de espalhado pelo sistema.
- Negativo: exige, em cada novo Caso de Uso, decidir explicitamente se ele se qualifica como Edge Function ou não — um critério mal aplicado pode tanto sub-proteger uma operação sensível quanto adicionar complexidade desnecessária a uma operação simples.

---

# Considerações Finais
```

Replace with:

```markdown
- Positivo: a maioria das operações (CRUD simples) tem latência menor, por não passar por uma camada de execução adicional.
- Positivo: o uso de `service_role` fica concentrado em um pequeno conjunto de Edge Functions auditáveis, em vez de espalhado pelo sistema.
- Negativo: exige, em cada novo Caso de Uso, decidir explicitamente se ele se qualifica como Edge Function ou não — um critério mal aplicado pode tanto sub-proteger uma operação sensível quanto adicionar complexidade desnecessária a uma operação simples.

---

## ADR-010 — Convite de usuário por código/link manual, sem Edge Function/e-mail transacional

**Status:** Aceita

**Contexto**

`12-API.md` (nota 2) e o `ADR-009` previam que convidar um novo usuário (UC-CGR-003) exigiria uma Edge Function usando a Supabase Auth Admin API (`inviteUserByEmail`), já que criar credenciais em `auth.users` só é possível com `service_role`. Ao planejar a implementação, verificou-se que o projeto Supabase não tem SMTP customizado configurado (toggle ligado, mas sem host/remetente preenchidos) nem domínio próprio — apenas hospedagem gratuita (`.web.app`/`.vercel.app`), cujo DNS não pode ser usado para autenticar envio de e-mail transacional. Como o SIPD é um projeto sem fins lucrativos, comprar um domínio só para isso foi descartado.

**Decisão**

UC-CGR-003 usa um mecanismo de convite por **código/link gerado e compartilhado manualmente** (RPC `security definer`, mesmo padrão de `completar_cadastro_congregacao`), em vez de Edge Function + e-mail. O convidado recebe o código/link por fora do sistema (ex.: WhatsApp) e o usa para vincular sua conta à congregação.

**Alternativas consideradas**

- Edge Function + Supabase Auth Admin API (`inviteUserByEmail`), como originalmente previsto — descartada por depender de e-mail transacional real, que exige domínio próprio verificado num provedor de SMTP (Resend, SendGrid etc.), custo recorrente incompatível com o caráter sem fins lucrativos do projeto.

**Consequências**

- Positivo: nenhuma dependência de infraestrutura de e-mail — funciona com o que o projeto já tem.
- Positivo: mesmo padrão de RPC `security definer` já usado em outras fatias, sem introduzir Edge Functions no projeto.
- Negativo: o compartilhamento do link é manual (fora do sistema), sem confirmação automática de identidade do destinatário — mitigado por um código de 8 caracteres com validade de 7 dias.
- Negativo: diverge do que `12-API.md`/`ADR-009` previam para este UC especificamente; ambos os documentos foram atualizados para refletir esta decisão.

---

# Considerações Finais
```

- [ ] **Step 6: Commit**

```bash
git add "docs/06.1.2 - Congregações.md" docs/12-API.md docs/13-ADR.md
git commit -m "docs(congregacoes): update UC-CGR-003, API mapping and ADR-010 for invite-by-code"
```

---

### Task 10: End-to-end manual verification

**Files:** none (verification only — no commit at the end unless a bug fix is needed, in which case fix it, re-verify, and commit the fix with a normal `fix(...)` message).

- [ ] **Step 1: Start the dev server**

From `frontend/`: `npm run web`, wait for `Web Bundled` in the log (poll `http://localhost:8081`, don't just sleep).

- [ ] **Step 2: Convite → conta nova, caminho feliz**

1. Log in as the existing Coordenador (Timirim congregação).
2. Navigate to the "Usuários" tab → confirm the current user's row shows with no edit/deactivate buttons on their own row (self-guard), and other rows (if any) show the buttons.
3. Click "Convidar Usuário" → pick perfil "Editor" → leave rótulo blank → "Gerar convite" → confirm an 8-character code appears, and it also shows up under "Convites pendentes".
4. Copy the code. Log out.
5. Go to `/signup`, create a brand-new account (new e-mail, 6+ char password) → lands on "Completar Cadastro" → click "Tenho um código de convite" → lands on "Aceitar Convite" with an empty code field.
6. Paste the code, fill Nome/Sobrenome/Telefone → "Aceitar convite" → confirm it lands directly on the `(app)` home screen.
7. Go to "Usuários" tab → confirm the new account appears with perfil "Editor" and `Ativo`.

- [ ] **Step 3: Verify in the database**

Via `execute_sql` MCP tool (`project_id: imeoyetcbjlkrxubwldv`):

```sql
select u.nome, u.sobrenome, p.nome as perfil, u.ativo, u.congregacao_id
from public.usuarios u join public.perfis p on p.id = u.perfil_id
order by u.criado_em desc limit 5;

select tipo, descricao, dados from public.historicos order by criado_em desc limit 5;

select status, aceito_em from public.convites_usuario order by criado_em desc limit 1;
```

Expected: the new user's row matches Step 2; `historicos` shows `usuario_criado_via_convite`; the convite's `status = 'Aceito'`.

- [ ] **Step 4: Convite → transferência**

1. Still logged in as the Coordenador, invite the account from Step 2 again is not possible (it already has a cadastro) — instead, create a **second** brand-new test account via `/signup` + "Completar Cadastro" (own new congregação, any unused número) so it has its own `usuarios` row as Coordenador of that new congregação.
2. Log back in as the original Timirim Coordenador → "Usuários" tab → "Convidar Usuário" → perfil "Editor" → generate a new code.
3. Log in as the second test account (from Step 4.1) → navigate directly to `/aceitar-convite` (address bar) → paste the new code → fill fields (should be pre-filled from the existing account's own nome/sobrenome/telefone) → "Aceitar convite".
4. Expected: lands on the `(app)` home screen; "Usuários" tab now under Timirim shows this account as "Editor"/Ativo.
5. Verify in the database: `select congregacao_id, perfil_id, ativo from public.usuarios where id = '<segundo-uuid>';` matches Timirim's `congregacao_id` and the Editor `perfil_id`; `select tipo, dados from public.historicos where tipo = 'usuario_transferido' order by criado_em desc limit 1;` shows the correct `congregacao_anterior_id`.

- [ ] **Step 5: Único Coordenador bloqueado**

1. As Administrador Global (or by checking the DB), confirm the second test account's own new congregação (from Step 4.1) has exactly one Coordenador — itself.
2. From the Timirim Coordenador, generate another invite code (perfil "Coordenador").
3. Log in as the second test account (still Coordenador of its own solo congregação) → `/aceitar-convite` → paste the code → submit.
4. Expected: error message "Você é o único Coordenador da sua congregação atual. Atribua o cargo a outro usuário antes de aceitar este convite." — no changes persisted (`select congregacao_id from usuarios where id = '<segundo-uuid>'` still shows its own congregação).
5. Via `execute_sql`, insert a second test user directly into that solo congregação as Editor (`insert into public.usuarios (id, congregacao_id, perfil_id, nome, sobrenome, email) select gen_random_uuid(), <congregacao-id>, (select id from perfis where nome = 'Editor'), 'Editor', 'Teste', 'editor-teste@example.com'` — note this bypasses the FK to `auth.users`, so only do this for the test and delete the row afterward, or skip straight to confirming the block message from Step 4 alone, which is the behavior that matters).
6. If the extra row was inserted: promote it to Coordenador (`update usuarios set perfil_id = ... where id = ...`), then retry accepting the same invite code as the second test account → confirm it now succeeds.

- [ ] **Step 6: Múltiplos convites pendentes**

As the Timirim Coordenador, generate two invite codes back-to-back (e.g. both perfil "Editor", different rótulos) without cancelling either → confirm both appear simultaneously under "Convites pendentes".

- [ ] **Step 7: Cancelar convite**

1. As the Timirim Coordenador, generate a new invite code, then immediately click "Cancelar" on it in "Convites pendentes".
2. Confirm it disappears from the list.
3. Try to accept that cancelled code from any logged-in account via `/aceitar-convite` → confirm "Código de convite inválido. Confira e tente novamente."

- [ ] **Step 8: Convite expirado**

Via `execute_sql`, back-date a pending convite: `update public.convites_usuario set expira_em = now() - interval '1 day' where status = 'Pendente' order by criado_em desc limit 1;` → try accepting that code → confirm "Esse convite expirou. Peça um novo código." and that `status` flips to `Expirado` in the database.

- [ ] **Step 9: Leitor sem ações**

If a Leitor account exists (or temporarily set one test account's perfil to "Leitor" via the Coordenador's "Editar perfil"), log in as it and confirm the "Usuários" tab shows the list with no edit/deactivate/convidar controls anywhere.

- [ ] **Step 10: Segurança — tentativas diretas**

Via `execute_sql` MCP tool:

```sql
-- 1. RPC sem role authenticated (simula o role `anon`, sem sessão) —
-- confirma que REVOKE EXECUTE FROM PUBLIC bloqueia antes mesmo do guard interno.
set local role anon;
select public.criar_convite_usuario((select id from public.perfis where nome = 'Editor'), 'teste anon');
reset role;
```

Expected: `permission denied for function criar_convite_usuario` (privilege error, not the RPC's own `não autenticado` exception — proves the `REVOKE ... FROM PUBLIC` from Task 1 is doing real work, not just the internal `auth.uid()` check).

```sql
-- 2. Simula um usuário autenticado tentando alterar o próprio perfil
-- (troque o uuid por uma conta de teste real).
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid-de-teste>"}';
update public.usuarios set perfil_id = (select id from public.perfis where nome = 'Administrador Global') where id = '<uuid-de-teste>';
reset role;
```

Expected: raises `não é permitido alterar seu próprio status ou perfil` (trigger fires), not a silent success.

- [ ] **Step 11: Console errors**

Throughout Steps 2–10, confirm no unexpected errors were logged to the browser console.

- [ ] **Step 12: Stop the dev server**

Kill the process listening on port 8081 (`netstat`-find the PID, `taskkill`) — don't leave it running.
