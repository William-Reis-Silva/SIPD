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
