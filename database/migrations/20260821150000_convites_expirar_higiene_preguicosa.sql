-- ============================================================================
-- SIPD — Fix: higienização preguiçosa de convites expirados + storage (06.1.6)
-- ============================================================================
--
-- Contexto:
-- Achado da revisão final de código do branch de Convites (link público).
--
-- Achado 1 (integridade de dado): `responder_convite_publico` fazia
--   `update ... set status = 'Expirado' where id = v_convite.id;`
--   imediatamente seguido de `raise exception 'convite_expirado';` — a
--   exceção desfaz toda a transação da chamada de RPC, inclusive o UPDATE
--   feito milissegundos antes (mesmo bug de
--   20260818213500_fix_expirar_convites_pendentes_lazy.sql, agora em
--   `convites`). O status nunca chegava a persistir por esse caminho, e
--   `convite_datas_verifica_exclusividade` trata qualquer convite com
--   status em ('Criado', 'Enviado') como "ainda aberto" — um convite
--   expirado nunca revisitado bloqueava suas datas candidatas para sempre,
--   violando a exigência do spec de liberar as datas de convites
--   expirados/finalizados.
--
-- Correção: seguindo o mesmo padrão da migração de 20260818213500 —
--   `convite_datas_verifica_exclusividade` (chamada sempre que a equipe
--   cria datas candidatas para um novo convite, ou seja, bem no momento em
--   que datas antigas poderiam ficar erroneamente bloqueadas) agora corrige
--   de forma preguiçosa o status de qualquer convite Criado/Enviado já
--   vencido da mesma congregação antes de checar exclusividade. E
--   `responder_convite_publico` teve a linha de UPDATE morta removida (o
--   `raise exception` logo em seguida nunca deixava persistir; `
--   consultar_convite_publico`, chamada antes desta RPC em todo carregamento
--   da página pública, já persiste `Expirado` corretamente sem raise em
--   seguida, então na prática o status já estará correto no banco antes
--   desta checagem rodar — esta é só uma defesa de janela de corrida).
--
-- Achado 5 (hardening de storage): bucket `convite-anexos` sem limites de
--   tamanho/tipo de arquivo, e a policy de insert nunca fechava a janela de
--   upload (checava só `status = 'Aceito'`, e nada move o convite para
--   fora desse status) — permitindo uploads mesmo após a Confirmação já ter
--   sido enviada.
--
-- Fontes: revisão final de código do branch Convites (2026-08-21).
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. `convite_datas_verifica_exclusividade` — varredura preguiçosa de
--    convites vencidos antes da checagem de exclusividade.
-- -----------------------------------------------------------------------
create or replace function public.convite_datas_verifica_exclusividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_congregacao_id uuid;
begin
  select congregacao_id into v_congregacao_id from public.convites where id = new.convite_id;

  update public.convites
  set status = 'Expirado'
  where congregacao_id = v_congregacao_id
    and status in ('Criado', 'Enviado')
    and expira_em < now();

  if exists (
    select 1
    from public.convite_datas cd
    join public.convites c on c.id = cd.convite_id
    where cd.data = new.data
      and c.congregacao_id = v_congregacao_id
      and c.status in ('Criado', 'Enviado')
      and c.id <> new.convite_id
  ) then
    raise exception 'data_ja_ofertada';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------
-- 2. `responder_convite_publico` — remove o UPDATE morto antes do raise.
-- -----------------------------------------------------------------------
create or replace function public.responder_convite_publico(
  p_token uuid,
  p_recusar boolean,
  p_data date default null,
  p_tema_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
  v_programacao_id uuid;
begin
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null or v_convite.status not in ('Criado', 'Enviado') then
    raise exception 'convite_invalido';
  end if;
  if v_convite.expira_em < now() then
    raise exception 'convite_expirado';
  end if;

  if p_recusar then
    update public.convites set status = 'Recusado', respondido_em = now() where id = v_convite.id;
    insert into public.historicos (usuario_id, tipo, descricao, dados)
    values (null, 'convite_recusado', 'Convite recusado pelo orador', jsonb_build_object('convite_id', v_convite.id));
    return jsonb_build_object('status', 'Recusado');
  end if;

  if not exists (select 1 from public.convite_datas where convite_id = v_convite.id and data = p_data) then
    raise exception 'data_invalida';
  end if;
  if not exists (
    select 1 from public.temas_preparados tp
    where tp.orador_id = v_convite.orador_id and tp.tema_id = p_tema_id and tp.ativo = true
  ) then
    raise exception 'tema_invalido';
  end if;
  if exists (
    select 1 from public.programacoes p
    where p.congregacao_id = v_convite.congregacao_id and p.tema_id = p_tema_id
      and p.status not in ('Realizada', 'Cancelada', 'Arquivada')
  ) then
    raise exception 'tema_indisponivel';
  end if;

  begin
    insert into public.programacoes (congregacao_id, tema_id, orador_id, data, status, criado_por)
    values (v_convite.congregacao_id, p_tema_id, v_convite.orador_id, p_data, 'Convite Enviado', v_convite.criado_por)
    returning id into v_programacao_id;
  exception when unique_violation then
    raise exception 'data_indisponivel';
  end;

  update public.convites
  set status = 'Aceito', respondido_em = now(), programacao_id = v_programacao_id
  where id = v_convite.id;

  insert into public.historicos (programacao_id, usuario_id, tipo, descricao, dados)
  values (v_programacao_id, null, 'convite_aceito', 'Convite aceito pelo orador',
          jsonb_build_object('convite_id', v_convite.id, 'data', p_data, 'tema_id', p_tema_id));

  return jsonb_build_object('status', 'Aceito', 'programacao_id', v_programacao_id);
end;
$$;

-- -----------------------------------------------------------------------
-- 3. Storage hardening — limites do bucket e fechamento da janela de
--    upload assim que a Confirmação for enviada.
-- -----------------------------------------------------------------------
update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'convite-anexos';

drop policy convite_anexos_insert on storage.objects;
create policy convite_anexos_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'convite-anexos'
    and exists (
      select 1 from public.convites c
      where c.token::text = (storage.foldername(name))[1]
        and c.status = 'Aceito'
        and not exists (select 1 from public.confirmacoes cf where cf.convite_id = c.id)
    )
  );
