-- ============================================================================
-- SIPD — Migração: revogar execução das RPCs de convite do role anon
-- ============================================================================
--
-- Contexto:
-- Verificação manual end-to-end (Task 10 do plano
-- docs/superpowers/sdd/2026-08-17-gerenciar-usuarios-congregacao) testou o
-- Step 10 (segurança — tentativas diretas) simulando `set local role anon`
-- e chamando `criar_convite_usuario` diretamente. O esperado era um erro de
-- privilégio (`permission denied`, 42501) vindo do próprio Postgres, antes
-- mesmo de entrar no corpo da função — provando que o `REVOKE ... FROM
-- PUBLIC` da Task 1 bloqueia de verdade, e não é só o `auth.uid() is null`
-- interno fazendo esse trabalho.
--
-- Só que a Task 1 revogou de `PUBLIC` e concedeu para `authenticated`, mas
-- nunca revogou explicitamente de `anon`. Como o Supabase concede EXECUTE em
-- funções novas do schema `public` para `anon`/`authenticated`/
-- `service_role` via privilégios padrão do schema, `anon` tinha uma
-- concessão própria que sobrevive a um REVOKE ... FROM PUBLIC (são
-- concessões independentes). `has_function_privilege('anon', ..., 'EXECUTE')`
-- confirmou `true` nas três RPCs antes desta migração — ou seja, uma
-- requisição PostgREST não autenticada (role `anon`) conseguia INVOCAR as
-- três funções e só era barrada pelo `auth.uid() is null` interno de cada
-- uma. Funcionalmente inofensivo hoje (a checagem interna sempre existiu e
-- sempre bloqueou), mas não é a defesa em camadas pretendida pelo desenho
-- original, e deixa de proteger caso algum caminho futuro nessas funções
-- não dependa de auth.uid().
--
-- Correção: revoga EXECUTE de `anon` explicitamente nas três RPCs, igualando
-- o comportamento observado ao pretendido pela Task 1.
-- ============================================================================

revoke execute on function public.criar_convite_usuario(uuid, varchar) from anon;
revoke execute on function public.aceitar_convite_usuario(varchar, varchar, varchar, varchar) from anon;
revoke execute on function public.cancelar_convite_usuario(uuid) from anon;
