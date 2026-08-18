-- ============================================================================
-- SIPD — Fix: higienização preguiçosa de convites expirados (UC-CGR-003)
-- ============================================================================
--
-- Contexto:
-- Descoberto durante a verificação manual do Task 10 do plano de
-- gerenciar-usuarios-congregacao. `aceitar_convite_usuario` tentava
-- persistir `status = 'Expirado'` antes de lançar a exceção
-- `convite_expirado`, mas uma exceção não tratada desfaz toda a transação
-- daquela chamada de RPC — inclusive o UPDATE feito milissegundos antes.
-- O status nunca chegava a persistir. O bloqueio ao aceitar continuava
-- correto (a função também checa `expira_em` diretamente, não só o
-- status), então o impacto era só de integridade de dado/relatório, sem
-- afetar segurança ou UX (a listagem de convites pendentes já filtra por
-- `expira_em > now()`).
--
-- Correção: `criar_convite_usuario` — chamada que sempre confirma
-- normalmente, sem exceção logo em seguida — agora corrige de forma
-- preguiçosa o status de qualquer convite Pendente já vencido da mesma
-- congregação antes de criar o novo.
--
-- Fontes: frontend/docs/superpowers/plans/2026-08-17-gerenciar-usuarios-congregacao.md (Task 10, Passo 8)
-- ============================================================================

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

  select p.nome into v_perfil_nome from public.perfis p where p.id = p_perfil_id;
  if v_perfil_nome is null then
    raise exception 'perfil_invalido';
  end if;
  if v_perfil_nome = 'Administrador Global' and not public.is_administrador_global() then
    raise exception 'sem_permissao_perfil_admin';
  end if;

  v_congregacao_id := public.current_usuario_congregacao_id();

  update public.convites_usuario cu
  set status = 'Expirado'
  where cu.congregacao_id = v_congregacao_id
    and cu.status = 'Pendente'
    and cu.expira_em < now();

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
