# Administração — Autenticação Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let the existing Administrador Global account log into the SIPD PWA, stay logged in across reloads, and log out — with unauthenticated users unable to reach the app shell.

**Architecture:** A `src/features/administracao/` module owns an `AuthProvider` (React Context) that mirrors Supabase Auth session state and fetches the matching `public.usuarios` row (joined with `perfis`). The Expo Router root layout uses `Stack.Protected` to show either the `(app)` route group (existing tab shell) or a `login` screen, based on that auth status — no manual redirect calls needed.

**Tech Stack:** Expo Router 57.0.12 (`expo-router/stack`, `Stack.Protected`), `@supabase/supabase-js` 2.112.3, NativeWind (styling), React Context (no new state library), no automated test framework (verification is manual — see each task).

**Spec:** `docs/superpowers/specs/2026-08-13-administracao-auth-design.md`

## Global Constraints

- Project alias `@/*` maps to `frontend/src/*` (see `tsconfig.json`) — use it for all cross-file imports.
- `Stack` and `Stack.Protected` must be imported from `expo-router/stack` (confirmed via `node_modules/expo-router/stack.d.ts`), not from `expo-router` directly — the root package does not re-export `Stack` in this version.
- Supabase project: `imeoyetcbjlkrxubwldv`. Tables already exist with RLS enabled: `public.perfis` (`id`, `nome`, `descricao`, `ativo`), `public.usuarios` (`id` = `auth.users.id`, `congregacao_id`, `perfil_id`, `nome`, `sobrenome`, `email`, `ativo`). RLS policy `usuarios_select` lets any authenticated user read their own row; `perfis_select` lets any authenticated user read all perfis. No migration changes needed for this plan.
- No new dependencies: no `zustand`, `react-hook-form`, or `zod` for this slice (per approved spec).
- Error copy (verbatim, per spec):
  - Invalid credentials or inactive account: `"Não foi possível autenticar. Verifique seu e-mail e senha."`
  - Network/unexpected failure during sign-in: `"Não foi possível concluir a autenticação no momento. Tente novamente."`
- Styling convention: NativeWind `className` + `SafeAreaView` from `react-native-safe-area-context`, matching `src/app/index.tsx` as it exists before this plan runs (light/dark via `dark:` variants, no separate theme file lookups for screens — that's only used by the tab bar).
- Verification throughout: `npx tsc --noEmit` (from `frontend/`) must pass with zero errors after every task before committing.

---

### Task 1: Auth Context — `AuthProvider` and `useAuth`

**Files:**
- Create: `frontend/src/features/administracao/auth-provider.tsx`
- Create: `frontend/src/features/administracao/use-auth.ts`

**Interfaces:**
- Consumes: `supabase` default export from `frontend/src/lib/supabase.ts` (already exists).
- Produces (used by Tasks 2 and 3):
  - `AuthProvider({ children }: { children: ReactNode })` — component, from `auth-provider.tsx`.
  - `AuthContext` — the raw `React.Context`, exported from `auth-provider.tsx` for `use-auth.ts` to consume.
  - `type Perfil = { id: string; nome: string; descricao: string | null }`, exported from `auth-provider.tsx`.
  - `type Usuario = { id: string; congregacao_id: string; perfil_id: string; nome: string; sobrenome: string; email: string; ativo: boolean; perfil: Perfil }`, exported from `auth-provider.tsx`.
  - `type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'`, exported from `auth-provider.tsx`.
  - `useAuth(): { status: AuthStatus; usuario: Usuario | null; signIn: (email: string, senha: string) => Promise<{ error: string | null }>; signOut: () => Promise<void> }`, from `use-auth.ts`. Throws if called outside an `AuthProvider`.

- [x] **Step 1: Create the features directory and write `auth-provider.tsx`**

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

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  usuario: Usuario | null;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_AUTH_ERROR = 'Não foi possível autenticar. Verifique seu e-mail e senha.';
const NETWORK_ERROR = 'Não foi possível concluir a autenticação no momento. Tente novamente.';

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

      if (!nextUsuario || !nextUsuario.ativo) {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
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
      // inactive account (FA-02) surfaces its error on the login screen itself,
      // instead of silently bouncing back to login with no message.
      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario || !nextUsuario.ativo) {
        await supabase.auth.signOut();
        return { error: GENERIC_AUTH_ERROR };
      }

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, usuario, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [x] **Step 2: Write `use-auth.ts`**

```ts
import { useContext } from 'react';

import { AuthContext } from './auth-provider';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
```

- [x] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. These two files aren't imported anywhere yet, so this only validates their own internal types.

- [x] **Step 4: Commit**

```bash
git add src/features/administracao/auth-provider.tsx src/features/administracao/use-auth.ts
git commit -m "feat(administracao): add AuthProvider and useAuth hook"
```

---

### Task 2: Protected routing — `(app)` group, root layout, login screen

**Files:**
- Create: `frontend/src/app/(app)/_layout.tsx`
- Create: `frontend/src/app/(app)/index.tsx` (moved from `frontend/src/app/index.tsx`, content unchanged in this task)
- Delete: `frontend/src/app/index.tsx` (via `git mv` into the path above)
- Create: `frontend/src/app/login.tsx`
- Modify: `frontend/src/app/_layout.tsx` (full rewrite)

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` from Task 1.
- Produces: no new exports — this task wires the two routes (`(app)` and `login`) that Task 3 will keep modifying.

- [x] **Step 1: Move the current Home screen into the `(app)` group**

```bash
mkdir -p src/app/\(app\)
git mv src/app/index.tsx "src/app/(app)/index.tsx"
```

Do not edit the file's content in this step — it still imports `@/lib/supabase` directly and shows the "Conexão com o Supabase" placeholder. Task 3 replaces that content.

- [x] **Step 2: Create `(app)/_layout.tsx`**

```tsx
import AppTabs from '@/components/app-tabs';

export default function AppLayout() {
  return <AppTabs />;
}
```

This preserves the existing tab shell (`AppTabs`, native or web variant resolved automatically by the bundler) — only its position in the route tree changes, from the root to inside `(app)`.

- [x] **Step 3: Create `login.tsx`**

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';

function isEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const { signIn } = useAuth();
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
    const { error } = await signIn(email.trim(), senha);
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
          Entre com sua conta para continuar.
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
            <Text className="font-medium text-white dark:text-neutral-900">Entrar</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 4: Rewrite the root `_layout.tsx`**

```tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthProvider } from '@/features/administracao/auth-provider';
import { useAuth } from '@/features/administracao/use-auth';

import '@/global.css';

function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </View>
    );
  }

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
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
```

- [x] **Step 5: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 6: Manual verification — unauthenticated and login flow**

Run (from `frontend/`): `npm run web`

1. With no active session (open in a private/incognito browser window, or clear site data for `localhost` first), confirm the app loads straight to the Login screen — not the Home/tabs shell.
2. Submit the login form with an obviously wrong password for `williamdosreissilva5@gmail.com` → confirm the generic error message appears (`"Não foi possível autenticar..."`) and the screen stays on Login.
3. Submit the login form with the real Administrador Global credentials → confirm you land on the Home screen (still showing the old "Conexão com o Supabase" placeholder at this point — that's expected, Task 3 replaces it) with the tab bar visible.

Stop and fix before proceeding if any of these three don't hold.

- [x] **Step 7: Commit**

```bash
git add "src/app/(app)/_layout.tsx" "src/app/(app)/index.tsx" src/app/index.tsx src/app/login.tsx src/app/_layout.tsx
git commit -m "feat(administracao): add protected routing (Stack.Protected) and login screen"
```

---

### Task 3: Home screen — show the logged-in user, wire logout

**Files:**
- Modify: `frontend/src/app/(app)/index.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()` from Task 1 (`usuario`, `signOut`).
- Produces: nothing new for later tasks — this is the last screen in this slice.

- [x] **Step 1: Rewrite `(app)/index.tsx`**

```tsx
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';

export default function HomeScreen() {
  const { usuario, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <View className="w-full max-w-sm items-center gap-3 px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">SIPD</Text>
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Sistema Inteligente de Programação de Discursos
        </Text>

        <View className="mt-6 w-full rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            {usuario?.nome} {usuario?.sobrenome}
          </Text>
          <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {usuario?.perfil.nome}
          </Text>
        </View>

        <Pressable
          onPress={() => signOut()}
          className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Manual verification — home content and logout**

Run (from `frontend/`): `npm run web` (if not still running), log in with the real Administrador Global credentials.

1. Confirm the Home screen shows the real name ("William Silva") and perfil ("Administrador Global") instead of the old connection placeholder.
2. Tap/click "Sair" → confirm you're redirected to the Login screen (via `Stack.Protected` reacting to the session becoming `null` — no manual navigation call involved).

- [x] **Step 4: Commit**

```bash
git add "src/app/(app)/index.tsx"
git commit -m "feat(administracao): show logged-in user and wire logout on Home"
```

---

### Task 4: End-to-end verification pass

No code changes expected unless a check below fails. This task confirms the full slice matches the spec's verification plan before considering the feature done.

**Files:** none (verification only; fix forward in the relevant task's files if something fails).

- [x] **Step 1: Full typecheck and Expo config check**

Run (from `frontend/`):
```bash
npx tsc --noEmit
npx expo-doctor
```
Expected: both clean (0 errors, 20/20 checks).

- [x] **Step 2: Run the 5-scenario manual verification from the spec**

Run (from `frontend/`): `npm run web`

1. Login with the real Administrador Global credentials → Home shows correct name/perfil.
2. Login with a wrong password → generic error, stays on Login.
3. Logout → back on Login; reload the page → still on Login (session was actually cleared, not just hidden).
4. While logged in, reload the page (F5) → session restored from storage, Home appears directly (no Login flash beyond the brief loading spinner).
5. While logged in, manually navigate the browser to `/login` → redirected back to `(app)` by `Stack.Protected`.

- [x] **Step 3: Confirm the web bundle still exports cleanly**

Run (from `frontend/`): `npx expo export -p web --output-dir ../../../temp-sipd-verify-export` (use an out-of-repo path so nothing gets committed by accident), then delete the output directory afterward.
Expected: export completes with no errors; delete the temp directory when done (`rm -rf ../../../temp-sipd-verify-export` or the OS equivalent).

- [x] **Step 4: Record the outcome**

If every check in Steps 1–3 passed with no code changes needed, no commit is required for this task — the feature is done as of Task 3's commit. If any fix was needed, commit it against the task whose file it belongs to (amend that task's change set conceptually, but still make a new commit — do not rewrite already-pushed history), e.g.:

```bash
git add <fixed files>
git commit -m "fix(administracao): <what was actually wrong>"
```
