-- ============================================================================
-- SIPD — Migração: correção de coluna ambígua em criar_convite_usuario
-- ============================================================================
--
-- Contexto:
-- Verificação manual end-to-end (Task 10 do plano
-- docs/superpowers/sdd/2026-08-17-gerenciar-usuarios-congregacao) encontrou
-- que `criar_convite_usuario` sempre falhava com um erro 400 genérico ao
-- gerar um convite pela UI.
--
-- Causa raiz: a função é declarada `RETURNS TABLE(id uuid, codigo varchar,
-- expira_em timestamptz)`, o que cria um parâmetro OUT implícito chamado
-- `id`, visível como variável em todo o corpo da função. A linha
-- `select nome into v_perfil_nome from public.perfis where id = p_perfil_id`
-- referencia `id` sem qualificador — o PL/pgSQL não consegue decidir se é o
-- parâmetro OUT `id` ou a coluna `perfis.id`, e lança
-- `42702: column reference "id" is ambiguous` toda vez que a RPC é chamada.
--
-- Correção: qualifica a referência como `p.id` (usando o alias já presente
-- na cláusula FROM). Nenhuma outra mudança de comportamento.
-- ============================================================================

create or replace function public.criar_convite_usuario(p_perfil_id uuid, p_rotulo character varying default null::character varying)
 returns table(id uuid, codigo character varying, expira_em timestamp with time zone)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  select p.nome into v_perfil_nome from public.perfis p where p.id = p_perfil_id;
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
$function$;
