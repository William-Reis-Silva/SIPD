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
