# Completar Cadastro — Autoatendimento de Congregação Nova Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone create an account, and if that account has no congregação yet, walk them through creating one (plus their own Coordenador profile) in a single "Completar Cadastro" flow.

**Architecture:** A new `security definer` RPC (`completar_cadastro_congregacao`) creates the congregação and the calling user's `usuarios` row in one transaction, mirroring the existing `encontrar_ou_criar_cidade` pattern — no new RLS policies on `congregacoes`/`usuarios` are added. `AuthProvider` gains a third status (`'onboarding'`, meaning "has a session but no `usuarios` row yet") and two new methods (`signUp`, `completarCadastro`). Two new screens (`signup.tsx`, `completar-cadastro.tsx`) reuse the exact Estado/Cidade `Dropdown` pattern already built for `congregacao.tsx`.

**Tech Stack:** Supabase (Postgres migration + RLS, already provisioned), `@supabase/supabase-js`, Expo Router (`Stack.Protected` guards, already in use in `_layout.tsx`), NativeWind, `react-native-element-dropdown` (already a dependency, no new packages), no automated test framework (verification is manual — see each task).

**Spec:** `docs/superpowers/specs/2026-08-16-completar-cadastro-congregacao-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*`.
- Supabase project: `imeoyetcbjlkrxubwldv`. Do not add or modify `INSERT` policies on `congregacoes` or `usuarios` — the RPC in Task 1 is `security definer` specifically to avoid needing them.
- No new npm dependencies.
- Error copy (verbatim, per spec):
  - Número duplicado: `"Já existe uma congregação com esse número. Peça para o Coordenador dela te convidar."`
  - Campos da congregação em branco: `"Informe o nome e o número da congregação."`
  - Cidade não selecionada: `"Selecione a cidade da congregação."`
  - Campos do usuário em branco: `"Preencha todos os campos."`
  - E-mail já em uso (signup): `"Esse e-mail já está em uso. Tente entrar na sua conta."`
  - Senha curta (signup): `"A senha precisa ter pelo menos 6 caracteres."`
  - Falha genérica (signup): `"Não foi possível criar a conta. Tente novamente."`
  - Falha genérica (completar cadastro): `"Não foi possível concluir o cadastro. Tente novamente."`
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, matching `src/app/login.tsx` and `src/app/(app)/congregacao.tsx` (light/dark via `dark:` variants). Reuse `useTheme()` (`@/hooks/use-theme`) for `Dropdown` colors, exactly as `congregacao.tsx` does.
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every task before committing.
- The Supabase project is shared/live — Task 1's migration is applied directly via the `apply_migration` MCP tool (no local Supabase stack in this project). Double-check the SQL before applying; there is no staging environment to rehearse against.
- `telefone` is added as a **nullable** column, not `not null` — the existing bootstrap user ("Timirim"/William) has no real phone number on record, and fabricating one would corrupt production data. The `completar-cadastro.tsx` form requires it client-side for new signups; the RPC parameter is required by signature but the column itself stays nullable for existing/future rows created through other paths.

---

### Task 1: Database — `telefone` column, `completar_cadastro_congregacao` RPC, and docs

**Files:**
- Create: `database/migrations/20260816180000_completar_cadastro_congregacao.sql`
- Modify: `docs/04-Regras-de-Negocio.md` (new RN-026)
- Modify: `docs/08-DER.md` (Usuários table, version bump)
- Modify: `docs/09-Dicionario-de-Dados.md` (Usuários table)

**Interfaces:**
- Produces: `public.usuarios.telefone` (`varchar`, nullable), consumed by Task 5's `completar-cadastro.tsx` and Task 2's `completarCadastro`.
- Produces: RPC `public.completar_cadastro_congregacao(p_nome_congregacao varchar, p_numero varchar, p_cidade_id uuid, p_nome_usuario varchar, p_sobrenome_usuario varchar, p_telefone varchar) returns table(usuario_id uuid, congregacao_id uuid)`, called via `supabase.rpc('completar_cadastro_congregacao', {...})` in Task 2.
- On duplicate `numero`, the RPC raises an exception whose message contains the literal string `numero_duplicado` — Task 2's error mapping matches on that substring.

- [ ] **Step 1: Apply the migration to the live Supabase project**

Use the `apply_migration` MCP tool (`project_id: imeoyetcbjlkrxubwldv`, `name: completar_cadastro_congregacao`) with this SQL:

```sql
-- Coluna telefone: usada hoje só no formulário de Completar Cadastro; no
-- futuro também servirá como chave de correspondência com `oradores`
-- (fora de escopo desta fatia). Nullable — contas existentes/criadas por
-- outros caminhos podem não ter telefone.
alter table public.usuarios add column telefone varchar;

-- RPC de autoatendimento: cria a congregação e o usuário Coordenador dela
-- numa única transação. security definer, mesmo estilo de
-- encontrar_ou_criar_cidade — evita abrir policies de INSERT em
-- congregacoes/usuarios (que hoje não existem ou são restritas a
-- Administrador Global).
create or replace function public.completar_cadastro_congregacao(
  p_nome_congregacao varchar,
  p_numero varchar,
  p_cidade_id uuid,
  p_nome_usuario varchar,
  p_sobrenome_usuario varchar,
  p_telefone varchar
) returns table(usuario_id uuid, congregacao_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_congregacao_id uuid;
  v_perfil_coordenador_id uuid;
  v_email varchar;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  if exists (select 1 from public.usuarios where id = v_uid) then
    raise exception 'usuário já possui cadastro completo';
  end if;

  select id into v_perfil_coordenador_id from public.perfis where nome = 'Coordenador';
  select email into v_email from auth.users where id = v_uid;

  begin
    insert into public.congregacoes (nome, numero, cidade_id)
    values (p_nome_congregacao, p_numero, p_cidade_id)
    returning id into v_congregacao_id;
  exception when unique_violation then
    raise exception 'numero_duplicado';
  end;

  insert into public.usuarios (id, congregacao_id, perfil_id, nome, sobrenome, email, telefone)
  values (v_uid, v_congregacao_id, v_perfil_coordenador_id, p_nome_usuario, p_sobrenome_usuario, v_email, p_telefone);

  return query select v_uid, v_congregacao_id;
end;
$$;

grant execute on function public.completar_cadastro_congregacao(varchar, varchar, uuid, varchar, varchar, varchar) to authenticated;
```

Expected: tool reports success.

- [ ] **Step 2: Verify the function and column exist**

Run (via `execute_sql` MCP tool, `project_id: imeoyetcbjlkrxubwldv`):

```sql
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'usuarios' and column_name = 'telefone';
select proname from pg_proc where proname = 'completar_cadastro_congregacao';
```

Expected: first query returns one row (`telefone`); second returns one row (`completar_cadastro_congregacao`).

- [ ] **Step 3: Save the migration as a local file**

Create `database/migrations/20260816180000_completar_cadastro_congregacao.sql` with a header comment (mirroring existing migration files) followed by the exact SQL from Step 1:

```sql
-- ============================================================================
-- SIPD — Migração: telefone em usuarios + RPC completar_cadastro_congregacao
-- ============================================================================
--
-- Contexto:
-- Autoatendimento de congregação nova (RN-026): uma conta recém-criada sem
-- congregação vinculada usa esta RPC para criar a congregação e a própria
-- linha em usuarios (perfil Coordenador) numa única transação, sem exigir
-- policies de INSERT abertas em congregacoes/usuarios.
--
-- Fontes: docs/superpowers/specs/2026-08-16-completar-cadastro-congregacao-design.md
-- ============================================================================

<same SQL as Step 1>
```

- [ ] **Step 4: Update `docs/04-Regras-de-Negocio.md` — new RN-026**

Find the "Congregações" section. After RN-025's block (before the `# Oradores` heading), insert:

```markdown
### RN-026

Toda congregação criada por autoatendimento deve ter, no momento da criação, um usuário vinculado com perfil Coordenador.

---
```

- [ ] **Step 5: Update `docs/08-DER.md` — Usuários table**

In section "## 5. Usuários", change the table to:

```markdown
| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_id | UUID | FK → congregacoes |
| perfil_id | UUID | FK → perfis |
| nome | VARCHAR | Nome |
| sobrenome | VARCHAR | Sobrenome |
| email | VARCHAR | E-mail da conta |
| telefone | VARCHAR | Opcional |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |
```

Bump the version line at the top of the file (`**Versão:** 1.3` → `1.4`).

- [ ] **Step 6: Update `docs/09-Dicionario-de-Dados.md` — Usuários table**

In the `usuarios` table section, change the table to:

```markdown
| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do usuário |
| congregacao_id | UUID | Sim | Não | Sim | Não | Congregação administrada pelo usuário |
| perfil_id | UUID | Sim | Não | Sim | Não | Perfil de acesso do usuário |
| nome | VARCHAR | Sim | Não | Não | Não | Nome do usuário |
| sobrenome | VARCHAR | Sim | Não | Não | Não | Sobrenome do usuário |
| email | VARCHAR | Sim | Não | Não | Não definido no DER | E-mail utilizado pela conta |
| telefone | VARCHAR | Não | Não | Não | Não | Telefone do usuário (RN-026); uso futuro como chave de correspondência com Oradores |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da conta |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |
```

- [ ] **Step 7: Commit**

```bash
git add database/migrations/20260816180000_completar_cadastro_congregacao.sql docs/04-Regras-de-Negocio.md docs/08-DER.md docs/09-Dicionario-de-Dados.md
git commit -m "feat(congregacoes): add telefone column and completar_cadastro_congregacao RPC"
```

---

### Task 2: `AuthProvider` — onboarding status, `signUp`, `completarCadastro`

**Files:**
- Modify: `frontend/src/features/administracao/auth-provider.tsx`

**Interfaces:**
- Consumes: `public.completar_cadastro_congregacao` RPC from Task 1.
- Produces (used by Task 4 and Task 5):
  - `AuthStatus = 'loading' | 'authenticated' | 'onboarding' | 'unauthenticated'`
  - `signUp(email: string, senha: string): Promise<{ error: string | null }>`
  - `completarCadastro(input: { nomeCongregacao: string; numero: string; cidadeId: string; nomeUsuario: string; sobrenomeUsuario: string; telefone: string }): Promise<{ error: string | null }>`
  - Existing `signIn`/`signOut`/`usuario`/`status` keep their current shape.

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

async function fetchUsuario(userId: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, congregacao_id, perfil_id, nome, sobrenome, email, ativo, perfil:perfis(id, nome, descricao)')
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
        // via signUp, aguardando o fluxo de Completar Cadastro.
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

      // Checked here (not just in the onAuthStateChange listener below) so an
      // inactive account surfaces its error on the login screen itself,
      // instead of silently bouncing back to login with no message. A missing
      // `usuarios` row is NOT an error here — onAuthStateChange routes that to
      // 'onboarding'.
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
        return { error: error.message.includes('numero_duplicado') ? ERRO_NUMERO_DUPLICADO : ERRO_CADASTRO_GENERICO };
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

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, usuario, signIn, signUp, completarCadastro, signOut }}>
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
git commit -m "feat(administracao): add onboarding status, signUp and completarCadastro"
```

---

### Task 3: Routing — onboarding guard and signup route

**Files:**
- Modify: `frontend/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `AuthStatus` from Task 2 (now includes `'onboarding'`).
- Assumes route files `signup.tsx` (Task 4) and `completar-cadastro.tsx` (Task 5) will exist — this task's `Stack.Screen name="..."` entries reference them by file name; Expo Router resolves them lazily, so this task can be committed before those files exist without breaking the currently-working routes (`(app)` and `login`).

- [ ] **Step 1: Update the `Stack` in `RootNavigator`**

In `frontend/src/app/_layout.tsx`, replace:

```tsx
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
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
    </Stack>
  );
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors (route names are plain strings, not statically checked, so this passes even before Tasks 4/5 create the files).

- [ ] **Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(administracao): add onboarding and signup routes to root navigator"
```

---

### Task 4: Signup screen

**Files:**
- Create: `frontend/src/app/signup.tsx`
- Modify: `frontend/src/app/login.tsx`

**Interfaces:**
- Consumes: `signUp` from `useAuth()` (Task 2).

- [ ] **Step 1: Create `frontend/src/app/signup.tsx`**

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';

function isEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit() {
    setErro(null);

    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    if (!isEmailValido(email.trim())) {
      setErro('Informe um e-mail válido.');
      return;
    }

    setEnviando(true);
    const { error } = await signUp(email.trim(), senha);
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">SIPD</Text>
        <Text className="mb-4 text-base text-neutral-500 dark:text-neutral-400">
          Crie sua conta para continuar.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />

        <TextInput
          value={senha}
          onChangeText={setSenha}
          placeholder="Senha"
          secureTextEntry
          autoComplete="password"
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
            <Text className="font-medium text-white dark:text-neutral-900">Criar conta</Text>
          )}
        </Pressable>

        <Link href="/login" className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Já tem conta? Entrar
        </Link>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Add a "Criar conta" link to `frontend/src/app/login.tsx`**

In `login.tsx`, add the import:

```tsx
import { Link } from 'expo-router';
```

And right after the closing `</Pressable>` of the submit button (before the closing `</View>`), add:

```tsx
        <Link href="/signup" className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Não tem conta? Criar conta
        </Link>
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/signup.tsx src/app/login.tsx
git commit -m "feat(administracao): add signup screen and login link"
```

---

### Task 5: Completar Cadastro screen

**Files:**
- Create: `frontend/src/app/completar-cadastro.tsx`

**Interfaces:**
- Consumes: `completarCadastro` from `useAuth()` (Task 2); `supabase` from `@/lib/supabase`; `useTheme` from `@/hooks/use-theme`; the `encontrar_ou_criar_cidade` RPC (already exists, used by `congregacao.tsx`).

- [ ] **Step 1: Create `frontend/src/app/completar-cadastro.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };

const ERRO_CRIAR_CIDADE = 'Não foi possível cadastrar a cidade. Tente novamente.';
const ERRO_CAMPOS_CONGREGACAO = 'Informe o nome e o número da congregação.';
const ERRO_CIDADE_OBRIGATORIA = 'Selecione a cidade da congregação.';
const ERRO_CAMPOS_USUARIO = 'Preencha todos os campos.';

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

export default function CompletarCadastroScreen() {
  const { completarCadastro } = useAuth();
  const colors = useTheme();

  const [passo, setPasso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [criandoCidade, setCriandoCidade] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeCongregacao, setNomeCongregacao] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [cidadeBusca, setCidadeBusca] = useState('');
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);

  const [nomeUsuario, setNomeUsuario] = useState('');
  const [sobrenomeUsuario, setSobrenomeUsuario] = useState('');
  const [telefone, setTelefone] = useState('');

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  useEffect(() => {
    supabase
      .from('estados')
      .select('id, nome, uf')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setEstados((data ?? []) as Estado[]));
  }, []);

  useEffect(() => {
    if (!estadoId) return;
    let ignorar = false;
    supabase
      .from('cidades')
      .select('id, nome')
      .eq('estado_id', estadoId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCidades((data ?? []) as CidadeOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, [estadoId]);

  const cidadeEncontrada = cidades.some((c) => normalizar(c.nome) === normalizar(cidadeBusca));
  const mostrarCriarCidade = !!estadoId && cidadeBusca.trim().length > 0 && !cidadeEncontrada;

  async function handleCriarCidade() {
    if (!estadoId || !cidadeBusca.trim()) return;
    setErro(null);
    setCriandoCidade(true);
    const { data, error } = await supabase.rpc('encontrar_ou_criar_cidade', {
      p_estado_id: estadoId,
      p_nome: cidadeBusca.trim(),
    });
    setCriandoCidade(false);

    if (error || !data) {
      setErro(ERRO_CRIAR_CIDADE);
      return;
    }

    const novaCidade = { id: data as string, nome: cidadeBusca.trim() };
    setCidades((atual) => [...atual, novaCidade].sort((a, b) => a.nome.localeCompare(b.nome)));
    setCidadeId(novaCidade.id);
    setCidadeBusca('');
  }

  function handleContinuar() {
    setErro(null);
    if (!nomeCongregacao.trim() || !numero.trim()) {
      setErro(ERRO_CAMPOS_CONGREGACAO);
      return;
    }
    if (!cidadeId) {
      setErro(ERRO_CIDADE_OBRIGATORIA);
      return;
    }
    setPasso(2);
  }

  async function handleConcluir() {
    setErro(null);
    if (!nomeUsuario.trim() || !sobrenomeUsuario.trim() || !telefone.trim()) {
      setErro(ERRO_CAMPOS_USUARIO);
      return;
    }

    setEnviando(true);
    const { error } = await completarCadastro({
      nomeCongregacao: nomeCongregacao.trim(),
      numero: numero.trim(),
      cidadeId,
      nomeUsuario: nomeUsuario.trim(),
      sobrenomeUsuario: sobrenomeUsuario.trim(),
      telefone: telefone.trim(),
    });
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Completar Cadastro</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {passo === 1 ? 'Passo 1 de 2 — Dados da congregação' : 'Passo 2 de 2 — Seus dados'}
        </Text>

        {passo === 1 ? (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeCongregacao}
              onChangeText={setNomeCongregacao}
              placeholder="Nome da congregação"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={numero}
              onChangeText={setNumero}
              placeholder="Número"
              keyboardType="numeric"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <Dropdown
              style={dropdownStyle}
              containerStyle={{ backgroundColor: colors.background }}
              placeholderStyle={{ color: colors.textSecondary }}
              selectedTextStyle={{ color: colors.text }}
              itemTextStyle={{ color: colors.text }}
              activeColor={colors.backgroundSelected}
              data={estados.map((e) => ({ id: e.id, label: `${e.nome} (${e.uf})` }))}
              labelField="label"
              valueField="id"
              value={estadoId}
              placeholder="Selecionar Estado"
              search
              searchPlaceholder="Buscar Estado..."
              onChange={(item) => {
                setEstadoId(item.id);
                setCidadeId('');
                setCidadeBusca('');
                setCidades([]);
              }}
            />
            <Dropdown
              style={dropdownStyle}
              containerStyle={{ backgroundColor: colors.background }}
              placeholderStyle={{ color: colors.textSecondary }}
              selectedTextStyle={{ color: colors.text }}
              itemTextStyle={{ color: colors.text }}
              activeColor={colors.backgroundSelected}
              disable={!estadoId}
              data={cidades.map((c) => ({ id: c.id, label: c.nome }))}
              labelField="label"
              valueField="id"
              value={cidadeId}
              placeholder={estadoId ? 'Selecionar Cidade' : 'Selecione o Estado primeiro'}
              search
              searchPlaceholder="Buscar Cidade..."
              onChangeText={setCidadeBusca}
              onChange={(item) => {
                setCidadeId(item.id);
                setCidadeBusca('');
              }}
            />
            {mostrarCriarCidade ? (
              <Pressable
                onPress={handleCriarCidade}
                disabled={criandoCidade}
                className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400 px-4 py-3 dark:border-neutral-500">
                {criandoCidade ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                    Cadastrar cidade &quot;{cidadeBusca.trim()}&quot;
                  </Text>
                )}
              </Pressable>
            ) : null}

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <Pressable
              onPress={handleContinuar}
              className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
              <Text className="font-medium text-white dark:text-neutral-900">Continuar</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeUsuario}
              onChangeText={setNomeUsuario}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={sobrenomeUsuario}
              onChangeText={setSobrenomeUsuario}
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

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => {
                  setErro(null);
                  setPasso(1);
                }}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConcluir}
                disabled={enviando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {enviando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Concluir cadastro</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
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
git add src/app/completar-cadastro.tsx
git commit -m "feat(administracao): add completar-cadastro screen"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only — no commit at the end unless a bug fix is needed, in which case fix it, re-verify, and commit the fix with a normal `fix(...)` message).

- [ ] **Step 1: Start the dev server**

From `frontend/`: `npm run web`, wait for `Web Bundled` in the log (poll `http://localhost:8081`, don't just sleep).

- [ ] **Step 2: Criar conta → Completar Cadastro, caminho feliz**

In a browser (or the Playwright-driven approach used earlier in this project — `playwright-core` + the cached Chromium at `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`, same recipe as the cidades feature verification):

1. Navigate to `http://localhost:8081` while logged out → confirm it lands on `/login`.
2. Click "Não tem conta? Criar conta" → confirm it navigates to `/signup`.
3. Fill a new e-mail (not used before) + a password with 6+ characters → submit.
4. Expected: lands directly on "Completar Cadastro" (Passo 1 de 2), no e-mail confirmation screen.
5. Fill Nome da congregação (e.g. "Teste Onboarding"), Número (any unused value, e.g. "99999"), Estado = "Minas Gerais", Cidade = search "Uberlândia" and pick it → "Continuar".
6. Expected: moves to Passo 2 de 2.
7. Fill Nome, Sobrenome, Telefone → "Concluir cadastro".
8. Expected: lands on the normal `(app)` home screen (no manual navigation needed — status flips to `'authenticated'` automatically).
9. Navigate to the "Congregação" tab → confirm it shows "Teste Onboarding", "99999", "Uberlândia" and an "Editar" button (proving the new account got the Coordenador perfil).

- [ ] **Step 3: Verify in the database**

Via `execute_sql` MCP tool (`project_id: imeoyetcbjlkrxubwldv`):

```sql
select c.nome, c.numero, u.nome, u.sobrenome, u.telefone, p.nome as perfil
from public.congregacoes c
join public.usuarios u on u.congregacao_id = c.id
join public.perfis p on p.id = u.perfil_id
where c.numero = '99999';
```

Expected: one row, `perfil = 'Coordenador'`, `telefone` matches what was typed in Step 2.7.

- [ ] **Step 4: Número duplicado**

Repeat Step 2's signup flow with a second new e-mail, but on Passo 1 use Número = `48991` (the real Timirim congregação's number) → "Continuar" → Passo 2 → fill and "Concluir cadastro".

Expected: stays on Passo 2 with the error "Já existe uma congregação com esse número. Peça para o Coordenador dela te convidar." No new row was created (re-run the query from Step 3 filtered by the test e-mail's expected data, or just re-check `select count(*) from public.congregacoes` didn't grow).

- [ ] **Step 5: Campos em branco**

On a fresh signup, leave "Nome da congregação" blank on Passo 1 and click "Continuar" → expect the client-side error "Informe o nome e o número da congregação." with no network call (no need to inspect network — the error appearing instantly, before any spinner, is enough signal).

- [ ] **Step 6: Login existente cai direto no app**

Log out (if logged in), then log in via `/login` with the account created in Step 2 (already has `usuarios` row).

Expected: lands directly on the `(app)` home screen — does NOT show "Completar Cadastro" again.

- [ ] **Step 7: Console errors**

Throughout Steps 2–6, confirm no unexpected errors were logged to the browser console (Supabase auth/PostgREST error responses are expected *content* on screen, but should not throw uncaught exceptions).

- [ ] **Step 8: Stop the dev server**

Kill the process listening on port 8081 (`netstat`-find the PID, `taskkill`), same as done previously in this project — don't leave it running.
