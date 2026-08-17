# Gerenciar Usuários da Congregação (UC-CGR-003)

**Data:** 2026-08-17
**Módulo:** Congregações (`06.1.2 - Congregações.md`)
**Fora de escopo (fatia futura):** ver "Não-objetivos".

---

## Contexto

UC-CGR-003 cobre consultar, convidar, editar, atribuir perfil, ativar/desativar e remover vínculo de usuários da própria congregação (Coordenador) ou de qualquer congregação (Administrador Global); Leitor só consulta.

`12-API.md` (nota 2) e `ADR-009` já prescreviam convite de usuário como Edge Function usando a Supabase Auth Admin API (`inviteUserByEmail`), com privilégio `service_role`. Ao planejar esta fatia, verificamos a configuração real do projeto Supabase ("Oradores"): o toggle "Enable custom SMTP" está ligado, mas sem host/remetente configurados (campos com placeholder, nunca preenchidos) — e o projeto não tem domínio próprio (usa apenas hospedagem gratuita tipo `.web.app`/`.vercel.app`, cujo DNS não pertence ao projeto e não pode ser usado para autenticar envio de e-mail transacional). Como o SIPD é um projeto sem fins lucrativos, comprar um domínio só para autenticação de e-mail (Resend/SendGrid etc.) foi descartado por ora.

Decisão: esta fatia **não usa Edge Function nem e-mail real**. O convite é por **código/link compartilhado manualmente** (WhatsApp, etc.) — mesmo padrão de RPC `security definer` já usado em `completar_cadastro_congregacao` e `encontrar_ou_criar_cidade`. Isso diverge do que `12-API.md`/`ADR-009` descreviam para este UC especificamente; a seção "Documentação a atualizar" trata disso.

Durante o design, surgiu um cenário adicional não descrito no texto original do UC: um usuário que já tem cadastro (ex.: mudou de congregação) aceita um convite de uma **nova** congregação. Em vez de tratar isso como um UC separado, o mesmo mecanismo de convite resolve os dois casos (criação e transferência) — ver "RPC `aceitar_convite_usuario`".

## Não-objetivos

- Envio de e-mail real (Edge Function + Auth Admin API). Fica registrado como caminho válido para quando o projeto tiver domínio próprio — ver ADR novo.
- Administrador Global gerenciar usuários de uma congregação que não é a sua própria através desta tela (sem seletor de congregação nesta fatia). A tela sempre opera sobre `usuario.congregacao_id` de quem está logado, igual ao padrão já usado em `congregacao.tsx`. Um AG que precise mexer em outra congregação ainda pode fazer isso diretamente pelo Supabase Studio (a RLS já permite).
- "Remover vínculo" como ação distinta de "desativar". Tratadas como a mesma ação (ver Parte 2 da discussão) — o schema inteiro já segue a convenção de nunca fazer hard delete (sem policy de DELETE em `usuarios`, mesmo padrão de outras tabelas).
- Reenvio de convite (o Coordenador cancela o pendente e cria um novo, se precisar).
- Testes automatizados (projeto ainda sem framework configurado — verificação manual, mesmo padrão das fatias anteriores).

## Arquitetura

### Modelo de Dados

**Tabela nova `convites_usuario`** (distinta de `convites`, que é Programação↔Orador):

```sql
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
```

**Gerador de código** (8 caracteres, sem `0/O/1/I/L` para reduzir erro de digitação manual):

```sql
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
```

**Trigger de autoproteção em `usuarios`** — fecha uma lacuna que já existia (`usuarios_self_update` permite editar qualquer coluna da própria linha, inclusive `ativo`/`perfil_id` — não só risco de autobloqueio, também de autopromoção):

```sql
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
```

A flag `sipd.bypass_self_guard` é ligada só internamente pela RPC `aceitar_convite_usuario` (transação local, via `set_config(..., true)`), no único caso legítimo de alguém alterar o próprio `ativo`/`perfil_id`: aceitar um convite de transferência.

**RLS de `convites_usuario`** (sem policy de INSERT — só é criado via RPC `security definer`):

```sql
alter table public.convites_usuario enable row level security;

create policy convites_usuario_select on public.convites_usuario
  for select to authenticated
  using (
    public.is_administrador_global()
    or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id())
  );

create policy convites_usuario_cancelar on public.convites_usuario
  for update to authenticated
  using (
    status = 'Pendente'
    and (public.is_administrador_global() or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id()))
  )
  with check (
    status = 'Cancelado'
    and (public.is_administrador_global() or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id()))
  );
```

**Ajuste em `historicos_select`** — hoje só libera leitura vinculada a `programacao_id`; Coordenador não conseguia ver histórico de ações sobre usuários da própria congregação:

```sql
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

**Novas RNs** (grupo "Congregações", após RN-026 em `04-Regras-de-Negocio.md`):

> **RN-027** — Um usuário não pode alterar o próprio status de ativo/inativo nem o próprio perfil. Apenas outro usuário com permissão de gerenciamento (Coordenador da congregação ou Administrador Global) pode fazer essas alterações.

> **RN-028** — Um usuário que seja o único Coordenador ativo de sua congregação não pode ser transferido para outra congregação antes que outro usuário assuma o perfil de Coordenador na congregação de origem.

### RPCs

**`criar_convite_usuario`** — Coordenador (própria congregação) ou Administrador Global; bloqueia atribuição do perfil Administrador Global por quem não é Administrador Global (FA-03):

```sql
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

grant execute on function public.criar_convite_usuario(uuid, varchar) to authenticated;
```

**`aceitar_convite_usuario`** — chamada pelo próprio convidado, já autenticado. Ramifica entre criação (não tem `usuarios` ainda) e transferência (já tem):

```sql
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

grant execute on function public.aceitar_convite_usuario(varchar, varchar, varchar, varchar) to authenticated;
```

O `for update` no select do convite evita corrida em aceitação concorrente (duas tentativas simultâneas com o mesmo código).

### Frontend

**Novo hook `src/features/congregacoes/use-usuarios-congregacao.ts`:**
- Lista usuários da congregação (`usuarios_select`, já existente).
- `atualizarPerfil(usuarioId, perfilId)` / `alternarAtivo(usuarioId, ativo)` — `update` direto via `usuarios_manage_update`.
- Perfis disponíveis para atribuição: todos exceto "Administrador Global", a menos que quem opera já seja Administrador Global.

**Novo hook `src/features/congregacoes/use-convites-usuario.ts`:**
- Lista convites `Pendente` (não expirados) da congregação.
- `criarConvite(perfilId, rotulo)` → RPC `criar_convite_usuario`, devolve código + link para compartilhar (`Share` do React Native).
- `cancelarConvite(id)` → update direto (`status: 'Cancelado', cancelado_em: now`).

**Tela nova `src/app/(app)/usuarios.tsx`:**
- Lista de usuários (nome, perfil, status) com ações de editar perfil / ativar-desativar, visíveis só para Coordenador/Administrador Global (`PODE_GERENCIAR`, mesmo padrão de `PODE_EDITAR` em `congregacao.tsx`).
- Seção "Convites pendentes" (só para quem gerencia): rótulo, perfil, validade, botão cancelar.
- Botão "Convidar Usuário" → modal/tela com seletor de perfil + rótulo opcional → mostra código/link gerado com opção de compartilhar/copiar.
- Leitor vê a lista sem nenhuma ação (FA-01).

**Tela nova `src/app/aceitar-convite.tsx`** (rota de topo, fora de `(app)`, igual a `login.tsx`/`signup.tsx`/`completar-cadastro.tsx` — precisa ser alcançável nos três `status` de auth):
- Lê `codigo` da query string (`useLocalSearchParams`), input editável (permite digitar manualmente se o link não carregou o parâmetro).
- `status === 'unauthenticated'`: mostra explicação curta + links para `/login` e `/signup` (**sem preservar o código automaticamente através do login/signup nesta fatia** — a pessoa reabre o link do convite depois de entrar; código válido por 7 dias, tempo suficiente). Simplificação deliberada, ver Não-objetivos.
- `status === 'onboarding'`: formulário de aceitar convite (nome/sobrenome/telefone em branco) — alternativa a "Completar Cadastro" (criação de congregação nova). `completar-cadastro.tsx` ganha um link "Tenho um código de convite" apontando para esta rota.
- `status === 'authenticated'`: formulário de aceitar convite com nome/sobrenome/telefone pré-preenchidos a partir de `usuario` (caso de transferência). Alcançável só pelo link compartilhado (sem entrada dedicada nos menus do app nesta fatia).
- Submit → novo método `aceitarConvite` em `AuthContext` (mesmo padrão de `completarCadastro`: chama a RPC, refaz `fetchUsuario`, atualiza `status`/`usuario`).

**`AuthProvider`:**
- Novo método `aceitarConvite(codigo, nome, sobrenome, telefone)` — chama `aceitar_convite_usuario`, depois re-sincroniza `usuario`/`status` (idêntico ao final de `completarCadastro`, reaproveitando o mesmo `fetchUsuario`).

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Código de convite inválido/não encontrado | RPC retorna `convite_invalido` | "Código de convite inválido. Confira e tente novamente." |
| Código expirado | RPC retorna `convite_expirado` | "Esse convite expirou. Peça um novo código." |
| Convidar sem permissão | RPC retorna `sem_permissao` | "Você não tem permissão para convidar usuários." |
| Tentar atribuir perfil Administrador Global sem ser Administrador Global | RPC retorna `sem_permissao_perfil_admin` | "Apenas o Administrador Global pode atribuir esse perfil." |
| Transferência com único Coordenador ativo na congregação atual | RPC retorna `unico_coordenador` | "Você é o único Coordenador da sua congregação atual. Atribua o cargo a outro usuário antes de aceitar este convite." |
| Falha genérica de rede/RPC | Exceção não classificada | "Não foi possível concluir a operação. Tente novamente." |

## Plano de verificação (manual)

Via `npm run web`:

1. Como Coordenador, criar um convite com perfil "Editor" → confirmar que o código/link aparece na lista de pendentes.
2. Abrir o link em outra sessão (conta nova, `signUp`) → cair na tela de aceitar convite com o código pré-preenchido → preencher nome/sobrenome/telefone → confirmar que entra direto no app como Editor da congregação certa.
3. Repetir com uma conta que **já tem cadastro** em outra congregação (transferência) → confirmar troca de `congregacao_id`/`perfil_id`/`ativo=true` e que o histórico registra `usuario_transferido`.
4. Tentar transferir o único Coordenador ativo de uma congregação → confirmar bloqueio com a mensagem de `unico_coordenador`; promover outro usuário a Coordenador primeiro → repetir e confirmar que agora funciona.
5. Tentar (via chamada direta à RPC/update, simulando um ataque) alterar o próprio `ativo`/`perfil_id` fora do fluxo de convite → confirmar bloqueio pela trigger.
6. Cancelar um convite pendente → confirmar que o código cancelado não é mais aceito por `aceitar_convite_usuario`.
7. Como Leitor, acessar a tela de usuários → confirmar que não aparece nenhuma ação de gerenciamento.
8. Deixar um convite expirar (ajustar `expira_em` manualmente no banco para teste) → tentar aceitar → confirmar mensagem de expirado e status atualizado para `Expirado`.

## Documentação a atualizar

- `06.1.2 - Congregações.md` — nova seção **FA-05 — Transferência entre congregações** em UC-CGR-003; ajustar FA-02 para refletir convite por código/link em vez de e-mail.
- `12-API.md` — linha de UC-CGR-003: trocar a Edge Function `POST /functions/v1/convidar-usuario` pelas RPCs `criar_convite_usuario`/`aceitar_convite_usuario`; remover/ajustar a nota de rodapé 2.
- `13-ADR.md` — novo ADR registrando a decisão de não usar Edge Function/e-mail neste UC (projeto sem fins lucrativos, sem domínio próprio para autenticar envio transacional) e o mecanismo de código/link escolhido como alternativa.
- `04-Regras-de-Negocio.md` — RN-027 e RN-028 (novas, ver "Modelo de Dados").
- `09-Dicionario-de-Dados.md` — tabela `convites_usuario`.

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_gerenciar_usuarios_congregacao.sql` (tabela `convites_usuario`, trigger de autoproteção, RPCs, ajuste de RLS em `historicos`)
- `src/features/congregacoes/use-usuarios-congregacao.ts`
- `src/features/congregacoes/use-convites-usuario.ts`
- `src/app/(app)/usuarios.tsx`
- `src/app/aceitar-convite.tsx`

**Modificados:**
- `src/features/administracao/auth-provider.tsx` — novo método `aceitarConvite`.
- `src/app/completar-cadastro.tsx` — link "Tenho um código de convite".
- `docs/06.1.2 - Congregações.md`, `docs/12-API.md`, `docs/13-ADR.md`, `docs/04-Regras-de-Negocio.md`, `docs/09-Dicionario-de-Dados.md` — ver "Documentação a atualizar".
