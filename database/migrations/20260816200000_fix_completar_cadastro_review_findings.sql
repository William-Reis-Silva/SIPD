-- ============================================================================
-- SIPD — Migração: correções da revisão final (Completar Cadastro)
-- ============================================================================
--
-- Contexto:
-- Revisão final de branch do plano "Completar Cadastro de Congregação"
-- (docs/superpowers/plans/2026-08-16-completar-cadastro-congregacao.md)
-- encontrou três problemas cross-cutting nas duas RPCs criadas por esse
-- plano. Esta migração corrige os três:
--
-- Finding 1 (Crítico): `encontrar_ou_criar_cidade` exigia
-- is_administrador_global() ou is_coordenador(), ambos lendo `public.usuarios`
-- pelo uid da chamada — mas um usuário em pleno fluxo de Completar Cadastro
-- ainda NÃO tem linha em `usuarios`, então os dois resolvem `false` e a RPC
-- sempre lançava 42501. O botão "Cadastrar cidade" nunca funcionava durante
-- o onboarding. Corrigido liberando também quem ainda não tem linha em
-- `usuarios` (mesmo nível de confiança de um Coordenador, já que essa pessoa
-- está a segundos de se tornar um).
--
-- Finding 4 (Importante): `completar_cadastro_congregacao` inseria
-- p_nome_congregacao/p_numero como recebidos, sem trim/validação. Um
-- chamador que bypassasse o frontend (ou um bug no frontend) poderia
-- inserir `'48991 '` (espaço final) e escapar da unique constraint
-- `congregacoes_numero_key` (intenção da RN-025). Agora faz trim e rejeita
-- valores em branco no servidor.
--
-- Finding 6 (Menor): `select id into v_perfil_coordenador_id from
-- public.perfis where nome = 'Coordenador'` falhava silenciosamente para
-- NULL (surgindo depois como uma violação de not-null opaca no insert de
-- `usuarios`) se esse nome de perfil fosse alterado. Agora há uma checagem
-- explícita com `raise exception` claro.
-- ============================================================================

-- Finding 1: onboarding users (mid Completar Cadastro, no usuarios row yet)
-- must also be allowed to create a cidade for their new congregação — same
-- trust level as a Coordenador, since they're seconds away from becoming one.
create or replace function public.encontrar_ou_criar_cidade(p_estado_id uuid, p_nome varchar)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (
    public.is_administrador_global()
    or public.is_coordenador()
    or not exists (select 1 from public.usuarios where id = auth.uid())
  ) then
    raise exception 'Sem permissão para cadastrar cidade.' using errcode = '42501';
  end if;

  select id into v_id
  from public.cidades
  where estado_id = p_estado_id
    and lower(trim(nome)) = lower(trim(p_nome))
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  begin
    insert into public.cidades (estado_id, nome)
    values (p_estado_id, trim(p_nome))
    returning id into v_id;
  exception when unique_violation then
    select id into v_id
    from public.cidades
    where estado_id = p_estado_id and nome = trim(p_nome);
  end;

  return v_id;
end;
$$;

grant execute on function public.encontrar_ou_criar_cidade(uuid, varchar) to authenticated;

-- Finding 4 + 6: trim/validate inputs server-side, and fail loudly (not with
-- a silent NULL-turned-not-null-violation) if the Coordenador perfil is missing.
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
  v_nome_congregacao varchar := trim(p_nome_congregacao);
  v_numero varchar := trim(p_numero);
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  if exists (select 1 from public.usuarios where id = v_uid) then
    raise exception 'usuário já possui cadastro completo';
  end if;

  if v_nome_congregacao = '' or v_numero = '' then
    raise exception 'campos obrigatórios em branco';
  end if;

  select id into v_perfil_coordenador_id from public.perfis where nome = 'Coordenador';
  if v_perfil_coordenador_id is null then
    raise exception 'perfil Coordenador não encontrado';
  end if;

  select email into v_email from auth.users where id = v_uid;

  begin
    insert into public.congregacoes (nome, numero, cidade_id)
    values (v_nome_congregacao, v_numero, p_cidade_id)
    returning id into v_congregacao_id;
  exception when unique_violation then
    raise exception 'numero_duplicado';
  end;

  insert into public.usuarios (id, congregacao_id, perfil_id, nome, sobrenome, email, telefone)
  values (v_uid, v_congregacao_id, v_perfil_coordenador_id, trim(p_nome_usuario), trim(p_sobrenome_usuario), v_email, trim(p_telefone));

  return query select v_uid, v_congregacao_id;
end;
$$;

grant execute on function public.completar_cadastro_congregacao(varchar, varchar, uuid, varchar, varchar, varchar) to authenticated;
