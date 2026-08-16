# Completar Cadastro — Autoatendimento de Congregação Nova

**Data:** 2026-08-16
**Módulo:** Congregações / Administração (não há UC formal em `06.1.x` — ver "Contexto")
**Fora de escopo (fatia futura):** reivindicação de perfil de Orador por telefone (depende do módulo Oradores existir e estar populado, e de Convites para ter valor real).

---

## Contexto

Nenhum documento em `docs/06.1.x` especifica um caso de uso de "criar congregação" pelo app. Os únicos UC-CGR são Consultar (001), Atualizar (002, feito) e Gerenciar Usuários (003, adiado — gerencia usuários de uma congregação **já existente**). A congregação real hoje ("Timirim") foi criada manualmente via migration (`bootstrap_admin_congregacao`), não por um fluxo de UI.

O usuário (dono do produto) decidiu abrir um fluxo de autoatendimento: qualquer pessoa pode criar uma conta nova; se essa conta não tiver uma congregação vinculada, o app pede para "completar o cadastro" — que cria a congregação e a própria conta como Coordenador dela, numa única operação. Não existe hoje nenhuma tela de criação de conta (só `login.tsx`), e a tabela `usuarios` não tem nenhuma RLS policy de `INSERT` — nenhum caminho client-side cria usuário hoje, só a migration de bootstrap.

O RLS de `congregacoes` já reflete a intenção anterior ("só Administrador Global cria congregação diretamente"): `congregacoes_insert ... with check (is_administrador_global())`. Esta fatia não muda essa policy — adiciona um caminho lateral controlado (RPC `security definer`) para o autoatendimento, preservando a policy existente para criação administrativa.

O número da congregação (`numero`, adicionado na fatia anterior) já é `unique` no banco — é a trava natural contra duas pessoas criando a "mesma" congregação duas vezes.

## Não-objetivos

- Reivindicação de perfil de Orador via telefone (fatia futura, depende de Oradores + Convites existirem).
- Aprovação/moderação de congregações novas por um Administrador Global. O autoatendimento é livre — qualquer conta sem congregação pode criar uma, a única trava é o número único.
- Editar/gerenciar usuários de uma congregação (isso é UC-CGR-003, continua adiado).
- Recuperação de senha, confirmação de e-mail (confirmação de e-mail foi desativada no projeto Supabase a pedido do usuário — sessão é entregue imediatamente após `signUp`).
- Testes automatizados (o projeto ainda não tem framework configurado — verificação manual via Playwright ad-hoc, como já feito na fatia anterior).

## Arquitetura

### Modelo de Dados

**Coluna nova em `usuarios`:**

```sql
alter table public.usuarios add column telefone varchar not null default '';
alter table public.usuarios alter column telefone drop default;
```

(`default ''` só para permitir adicionar `not null` numa tabela que já tem 1 linha — `bootstrap_admin_congregacao` precisa de um `update` de backfill com o telefone real antes do `alter ... not null`, análogo ao que a migration de `numero` fez para `congregacoes`.)

Motivo do campo: uso futuro como chave de correspondência entre uma conta de usuário e um registro em `oradores` (reivindicação de perfil) — fora de escopo aqui, mas o campo entra agora para não exigir outra migration de schema quando essa fatia futura for construída.

**Nova RN-026** (grupo "Congregações", após RN-025 em `04-Regras-de-Negocio.md`):

> Toda congregação criada por autoatendimento deve ter, no momento da criação, um usuário vinculado com perfil Coordenador.

`09-Dicionario-de-Dados.md` ganha a linha `telefone` na tabela `usuarios`.

### RPC — `completar_cadastro_congregacao`

`security definer`, mesmo estilo de `encontrar_ou_criar_cidade` — cria congregação + usuário numa transação, sem exigir novas policies de `INSERT` em `congregacoes`/`usuarios`:

```sql
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

O erro `numero_duplicado` é um sinal de texto simples (não uma classe de exceção Postgres formal) que o frontend reconhece pela mensagem para mostrar o texto amigável — mesma convenção pragmática já usada no tratamento de erro de `congregacao.tsx` existente.

### Frontend

**`AuthProvider` (`src/features/administracao/auth-provider.tsx`):**
- Novo valor de `AuthStatus`: `'onboarding'` — sessão Supabase válida, mas sem linha em `usuarios`.
- `syncFromSession` e `signIn` hoje tratam "sem linha em `usuarios`" e "`ativo = false`" da mesma forma (erro genérico + signOut). Precisam se separar: `ativo = false` continua sendo signOut com erro; "sem linha em `usuarios`" vira `status = 'onboarding'` (não é erro, é o estado esperado logo após `signUp`).
- Novo método `signUp(email, senha)` — chama `supabase.auth.signUp({ email, password: senha })`. Com confirmação de e-mail desativada, a sessão já vem preenchida na resposta.
- Novo método `completarCadastro(dados)` — chama a RPC `completar_cadastro_congregacao` e, em caso de sucesso, força um novo `fetchUsuario` (mesmo helper já existente) para transicionar `status` para `'authenticated'`.

**Roteamento (`_layout.tsx`):**
- Novo `Stack.Protected guard={status === 'onboarding'}` apontando para a rota `completar-cadastro`.
- `login.tsx` ganha um link/botão "Criar conta" levando a uma tela nova `signup.tsx` (mesma pasta de `login.tsx`, fora do grupo `(app)` — acessível quando `status === 'unauthenticated'`).

**Tela nova `src/app/signup.tsx`:**
- Campos: E-mail, Senha (mesmo padrão visual/validação de `login.tsx`).
- Submit → `signUp` → sucesso transiciona automaticamente para `status = 'onboarding'` via o listener já existente em `AuthProvider` (`onAuthStateChange`), sem navegação manual.

**Tela nova `src/app/completar-cadastro.tsx`:**
- Passo 1 — Congregação: Nome, Número, seletor Estado → Cidade (reaproveita exatamente os dois `Dropdown` de `congregacao.tsx`, incluindo a opção de cadastrar cidade nova via `encontrar_ou_criar_cidade`).
- Passo 2 — Usuário: Nome, Sobrenome, Telefone.
- Botão "Concluir cadastro" (só habilitado no passo 2, após passo 1 validado) → chama `completarCadastro`.
- Estado de carregamento no botão, mesmo padrão de `login.tsx`/`congregacao.tsx`.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Número já em uso por outra congregação | RPC retorna `numero_duplicado` (via `unique_violation` capturado) | "Já existe uma congregação com esse número. Peça para o Coordenador dela te convidar." |
| Campo obrigatório em branco (qualquer um dos 6) | Validação client-side, antes de chamar a RPC | "Preencha todos os campos." |
| E-mail já cadastrado (na tela Criar Conta) | Erro do `signUp` | "Esse e-mail já está em uso. Tente entrar na sua conta." |
| Senha curta demais | Erro do `signUp` (mínimo do Supabase Auth) | "A senha precisa ter pelo menos 6 caracteres." |
| Falha de rede/RPC genérica | Exceção não classificada | "Não foi possível concluir o cadastro. Tente novamente." |
| RPC chamada com usuário já cadastrado (edge case) | RPC retorna "usuário já possui cadastro completo" | Redireciona silenciosamente para o app (o `AuthProvider` deveria já estar em `'authenticated'` nesse caso; é defensivo, não deveria ocorrer na prática) |

## Plano de verificação (manual)

Via `npm run web`, mesmo esquema Playwright ad-hoc usado na fatia anterior:

1. Tela de login → "Criar conta" → preencher e-mail novo + senha → confirmar que cai direto na tela "Completar Cadastro" (sem tela de confirmação de e-mail).
2. Preencher passo 1 (congregação com número inédito) e passo 2 (usuário + telefone) → "Concluir cadastro" → confirmar que cai na tela normal do app, como Coordenador da congregação nova.
3. Conferir no banco: a congregação nova existe com o número certo, e a linha em `usuarios` tem `perfil_id` = Coordenador e o `telefone` salvo.
4. Repetir o cadastro de conta com um número de congregação já existente (ex.: `48991`, da Timirim) → confirmar a mensagem de erro amigável e que nenhuma linha órfã foi criada em `congregacoes` (a RPC só insere `usuarios` depois do insert de `congregacoes` suceder — testar que uma falha no passo da congregação não deixa lixo).
5. Deixar um campo obrigatório em branco → confirmar validação client-side, sem chamada à RPC.
6. Logar com a conta recém-criada (fluxo normal de `login.tsx`, sessão nova) → confirmar que cai direto no app (`status = 'authenticated'`), sem passar por "Completar Cadastro" de novo.

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_add_telefone_usuarios_completar_cadastro.sql` (coluna `telefone` + função `completar_cadastro_congregacao`)
- `src/app/signup.tsx`
- `src/app/completar-cadastro.tsx`

**Modificados:**
- `src/features/administracao/auth-provider.tsx` — novo status `onboarding`, métodos `signUp` e `completarCadastro`, separar tratamento de "sem usuário" vs. "inativo".
- `src/app/_layout.tsx` — nova rota protegida por `status === 'onboarding'`.
- `src/app/login.tsx` — link "Criar conta".
- `docs/04-Regras-de-Negocio.md` — nova RN-026.
- `docs/09-Dicionario-de-Dados.md` — coluna `telefone` em `usuarios`.
