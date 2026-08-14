# Administração — Autenticação Core (Login, Logout, Sessão)

**Data:** 2026-08-13
**Módulo:** Administração (`docs/06.1.1 - Administração.md`)
**Casos de Uso cobertos:** UC-ADM-001 (Autenticar Usuário), UC-ADM-004 (Encerrar Sessão)
**Fora de escopo (próxima fatia):** UC-ADM-002 (Recuperar Senha), UC-ADM-003 (Alterar Senha), UC-ADM-005 (Gerenciar Usuários), UC-ADM-006 (Gerenciar Perfis), UC-ADM-007 (Gerenciar Permissões)

---

## Contexto

O banco de dados já está provisionado no projeto Supabase (`imeoyetcbjlkrxubwldv`): tabelas `usuarios` e `perfis` existem com RLS habilitado, os 4 perfis da V1 estão semeados, e já existe uma conta de Administrador Global (bootstrap) pronta para uso. Nenhuma migration nova é necessária para esta fatia.

O frontend (Expo Router + NativeWind + cliente Supabase) está com o scaffold básico funcionando, mas sem nenhum fluxo de autenticação: a rota raiz sempre renderiza a mesma área (com um cliente Supabase que só testava conectividade), sem distinguir usuário logado de deslogado.

Esta fatia entrega o suficiente para logar com a conta já existente e para que os módulos seguintes do roadmap (Congregações, Oradores, ...) tenham uma base de "usuário autenticado" para exigir.

## Não-objetivos

- Recuperação/alteração de senha (UC-ADM-002/003).
- Qualquer tela de gestão de usuários, perfis ou permissões (UC-ADM-005/006/007).
- Testes automatizados: o projeto não tem framework de testes configurado ainda; a verificação desta fatia é manual (ver "Plano de verificação").

## Arquitetura

### Módulo `src/features/administracao/`

- `auth-provider.tsx` — `AuthProvider`, um `React.Context` que:
  1. Ao montar, chama `supabase.auth.getSession()` para o estado inicial.
  2. Assina `supabase.auth.onAuthStateChange` para manter a sessão sincronizada.
  3. Quando há sessão, busca a linha correspondente em `public.usuarios` (join com `perfis`) via `supabase.from('usuarios').select('*, perfil:perfis(*)').eq('id', session.user.id).single()` — cobre o passo 8 do UC-ADM-001 ("o sistema identifica o Perfil do Usuário").
  4. Expõe `status: 'loading' | 'authenticated' | 'unauthenticated'`, `usuario` (linha de domínio + perfil, ou `null`), `signIn(email, senha)`, `signOut()`.
- `use-auth.ts` — hook `useAuth()` que lê o Context (lança erro se usado fora do `AuthProvider`, para pegar erros de composição cedo).

Nenhuma lib de estado global nova (Zustand/Query) — o próprio SDK do Supabase persiste a sessão (AsyncStorage no nativo, localStorage na Web), então o Context só precisa espelhar esse estado em memória.

### Roteamento (Expo Router, `expo-router` 57.0.12)

Estrutura atual: `src/app/_layout.tsx` renderiza `AppTabs` diretamente (sem grupo de rotas), então não há como ter uma tela fora da tab bar. Reestruturação:

```
src/app/
├── _layout.tsx          # Stack raiz com Stack.Protected, dentro do AuthProvider
├── login.tsx             # tela pública, fora do grupo (app)
└── (app)/
    ├── _layout.tsx       # renderiza o AppTabs atual (shell de tabs)
    └── index.tsx         # Home atual, adaptada (ver "Telas")
```

`src/app/_layout.tsx`:

```tsx
<AuthProvider>
  <ThemeProvider ...>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'authenticated'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  </ThemeProvider>
</AuthProvider>
```

Enquanto `status === 'loading'`, nenhum dos dois grupos casa com `guard`; renderiza-se uma tela de carregamento simples (evita flash da tela de login antes da sessão persistida ser restaurada).

`Stack.Protected` foi confirmado como existente nesta versão exata (`node_modules/expo-router/build/views/Protected.d.ts`, `guard: boolean`), conforme orientação do `AGENTS.md` do projeto de checar a versão instalada antes de escrever código.

`src/components/app-tabs.tsx` e `app-tabs.web.tsx` não mudam de conteúdo, só de localização (movem para dentro de `(app)/_layout.tsx`).

## Telas

### `src/app/login.tsx`

- Campos e-mail/senha (`useState`), sem lib de formulário — 2 campos não justificam adicionar `react-hook-form`/`zod` agora.
- Validação manual: campos não vazios, formato básico de e-mail antes de chamar `signIn`.
- Estado de carregamento no botão de submit (evita duplo submit).
- Erros mapeados (ver "Tratamento de erros").

### `src/app/(app)/index.tsx`

Substitui o placeholder "Conexão com o Supabase" (que só validava a configuração do cliente — papel já cumprido) por uma Home mínima que mostra `usuario.nome` e `usuario.perfil.nome`, e um botão "Sair" que chama `signOut()`. O `Stack.Protected` cuida do redirecionamento para `/login` assim que a sessão cai — a tela não precisa navegar manualmente.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Credenciais inválidas (FA-01, UC-ADM-001) | Erro do `signInWithPassword` | "Não foi possível autenticar. Verifique seu e-mail e senha." — genérica, não revela qual campo está errado |
| Conta desativada (FA-02, UC-ADM-001) | `usuarios.ativo = false` após login bem-sucedido no Auth | Mesma mensagem genérica de credenciais inválidas + `signOut()` imediato (a sessão do Auth não deve persistir para uma conta desativada) |
| Falha de comunicação (FE-01, UC-ADM-001) | Exceção de rede | "Não foi possível concluir a autenticação no momento. Tente novamente." |

## Plano de verificação (manual)

Sem framework de testes configurado, a verificação desta fatia é manual via `npm run web`:

1. Login com a conta de Administrador Global existente → deve cair na Home com nome/perfil corretos.
2. Login com senha errada → mensagem genérica de erro, sem navegar.
3. Logout → volta para `/login`; recarregar a página não deve reabrir a área autenticada.
4. Recarregar a página logado (F5) → sessão restaurada a partir do storage, sem passar pela tela de login (valida a persistência do SDK).
5. Acessar `/login` diretamente enquanto autenticado → `Stack.Protected` deve redirecionar para `(app)`.

## Arquivos afetados

**Novos:**
- `src/features/administracao/auth-provider.tsx`
- `src/features/administracao/use-auth.ts`
- `src/app/login.tsx`
- `src/app/(app)/_layout.tsx`

**Movidos (sem mudança de conteúdo):**
- `src/app/index.tsx` → `src/app/(app)/index.tsx` (com o conteúdo adaptado, ver "Telas")

**Modificados:**
- `src/app/_layout.tsx` — vira o `Stack` protegido descrito acima
