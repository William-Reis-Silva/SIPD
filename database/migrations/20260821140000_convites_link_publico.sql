-- ============================================================================
-- SIPD — Migração: Convites — link público com token (06.1.6)
-- ============================================================================
--
-- Contexto:
-- Ver frontend/docs/superpowers/specs/2026-08-21-convites-design.md.
-- `convites` (criada em 20260812130000) assumia Programação pré-existente e
-- resposta autenticada (RN-035/036, UC-ORA-007 — nunca implementado). Este
-- módulo desacopla o Convite de uma Programação (que só nasce quando o
-- Orador aceita) e move a resposta para um link público com token (ADR-011).
--
-- Achados corrigidos nesta migração em relação ao spec original:
-- 1. `convites` não tinha coluna `criado_por` — necessária para que a
--    Programação criada por `responder_convite_publico` (sem usuário
--    autenticado) tenha um `criado_por` válido (NOT NULL).
-- 2. `convites_select`/`historicos_select` (RLS) ainda dependiam de
--    `programacao_id`, que agora é nulo até o Orador aceitar — a equipe não
--    conseguiria ver convites `Criado`/`Enviado` nem seu histórico.
-- 3. `responder_convite_publico` não tratava colisão de unicidade entre a
--    data escolhida e uma Programação já existente na congregação criada
--    fora do fluxo de Convites — adicionado catch amigável.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-21-convites-design.md
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. Alterações em `convites` (tabela vazia hoje — sem UI nunca construída,
--    sem necessidade de backfill em nenhuma coluna nova)
-- -----------------------------------------------------------------------
alter table public.convites
  alter column programacao_id drop not null,
  add column congregacao_id uuid references public.congregacoes (id),
  add column token uuid not null default gen_random_uuid(),
  add column expira_em timestamptz not null default (now() + interval '7 days'),
  add column criado_por uuid not null references public.usuarios (id),
  add constraint convites_token_key unique (token);

alter table public.convites alter column congregacao_id set not null;

create index convites_congregacao_id_idx on public.convites (congregacao_id);
create index convites_token_idx on public.convites (token);

-- -----------------------------------------------------------------------
-- 2. Nova tabela `convite_datas` (datas candidatas oferecidas ao Orador)
-- -----------------------------------------------------------------------
create table public.convite_datas (
  id          uuid primary key default gen_random_uuid(),
  convite_id  uuid not null references public.convites (id) on delete cascade,
  data        date not null,
  criado_em   timestamptz not null default now(),
  constraint convite_datas_convite_data_key unique (convite_id, data)
);

create index convite_datas_convite_id_idx on public.convite_datas (convite_id);

alter table public.convite_datas enable row level security;

-- -----------------------------------------------------------------------
-- 3. Exclusividade de data entre convites abertos da mesma congregação
--    (Ponto 1 do spec — checagem no banco, não só na UI)
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

create trigger convite_datas_verifica_exclusividade before insert on public.convite_datas
  for each row execute function public.convite_datas_verifica_exclusividade();

-- -----------------------------------------------------------------------
-- 4. Coluna de anexos em `confirmacoes` (RN-072)
-- -----------------------------------------------------------------------
alter table public.confirmacoes add column anexos jsonb not null default '[]';

-- -----------------------------------------------------------------------
-- 5. Trigger RN-073 — Programação assume 'Confirmada' ao enviar Confirmação
--    (12-API.md já documentava a intenção; nenhuma migração criava o trigger)
-- -----------------------------------------------------------------------
create or replace function public.confirmacao_confirma_programacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.programacoes
  set status = 'Confirmada'
  where id = (select programacao_id from public.convites where id = new.convite_id)
    and status not in ('Realizada', 'Cancelada', 'Arquivada');
  return new;
end;
$$;

create trigger confirmacao_confirma_programacao after insert on public.confirmacoes
  for each row execute function public.confirmacao_confirma_programacao();

-- -----------------------------------------------------------------------
-- 6. RLS — `convites` reescrita: `congregacao_id` já está na própria linha,
--    não precisa mais de join em `programacoes` (nulo até o aceite).
-- -----------------------------------------------------------------------
drop policy convites_select on public.convites;
create policy convites_select on public.convites
  for select to authenticated
  using (
    public.is_administrador_global()
    or congregacao_id = public.current_usuario_congregacao_id()
    or exists (
      select 1 from public.oradores o
      where o.id = convites.orador_id and o.usuario_id = auth.uid()
    )
  );

drop policy convites_staff_write on public.convites;
create policy convites_staff_write on public.convites
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  );

drop policy convites_staff_update on public.convites;
create policy convites_staff_update on public.convites
  for update to authenticated
  using (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  )
  with check (
    public.is_administrador_global()
    or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id())
  );

-- `convites_orador_responde` (RN-036) fica como está — inofensiva e inerte
-- enquanto nenhum Orador tiver `usuario_id` vinculado (UC-ORA-007 não existe
-- nesta fatia); se for construído no futuro, já funciona sem alteração.

-- -----------------------------------------------------------------------
-- 7. RLS — `convite_datas` (leitura/escrita pela equipe da congregação)
-- -----------------------------------------------------------------------
create policy convite_datas_select on public.convite_datas
  for select to authenticated
  using (
    public.is_administrador_global()
    or exists (
      select 1 from public.convites c
      where c.id = convite_datas.convite_id
        and c.congregacao_id = public.current_usuario_congregacao_id()
    )
  );

create policy convite_datas_staff_insert on public.convite_datas
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or exists (
      select 1 from public.convites c
      where c.id = convite_datas.convite_id
        and c.congregacao_id = public.current_usuario_congregacao_id()
        and public.is_coordenador_ou_editor()
    )
  );

-- -----------------------------------------------------------------------
-- 8. RLS — `historicos_select` reescrita: eventos de Convite anteriores ao
--    aceite têm `programacao_id` nulo e `convite_id` só em `dados` (jsonb).
-- -----------------------------------------------------------------------
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
      select 1 from public.convites c
      where c.id = (historicos.dados ->> 'convite_id')::uuid
        and c.congregacao_id = public.current_usuario_congregacao_id()
    )
  );

-- -----------------------------------------------------------------------
-- 9. RPCs públicas (sem login — `anon`, ADR-011)
-- -----------------------------------------------------------------------
create or replace function public.consultar_convite_publico(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
  v_resultado jsonb;
begin
  select c.*, o.nome as orador_nome, o.sobrenome as orador_sobrenome,
         cg.nome as congregacao_nome, cg.numero as congregacao_numero
  into v_convite
  from public.convites c
  join public.oradores o on o.id = c.orador_id
  join public.congregacoes cg on cg.id = c.congregacao_id
  where c.token = p_token;

  if v_convite.id is null then
    raise exception 'convite_invalido';
  end if;

  if v_convite.status in ('Criado', 'Enviado') and v_convite.expira_em < now() then
    update public.convites set status = 'Expirado' where id = v_convite.id;
    v_convite.status := 'Expirado';
  end if;

  v_resultado := jsonb_build_object(
    'status', v_convite.status,
    'orador_nome', v_convite.orador_nome || ' ' || v_convite.orador_sobrenome,
    'congregacao_nome', v_convite.congregacao_nome,
    'datas_candidatas', (
      select coalesce(jsonb_agg(cd.data order by cd.data), '[]'::jsonb)
      from public.convite_datas cd where cd.convite_id = v_convite.id
    ),
    'temas_disponiveis', case when v_convite.status in ('Criado', 'Enviado') then (
      select coalesce(jsonb_agg(jsonb_build_object('tema_id', tp.tema_id, 'numero', t.numero, 'titulo', t.titulo)), '[]'::jsonb)
      from public.temas_preparados tp
      join public.temas t on t.id = tp.tema_id
      where tp.orador_id = v_convite.orador_id and tp.ativo = true
        and not exists (
          select 1 from public.programacoes p
          where p.congregacao_id = v_convite.congregacao_id
            and p.tema_id = tp.tema_id
            and p.status not in ('Realizada', 'Cancelada', 'Arquivada')
        )
    ) else null end,
    'confirmacao_pendente', v_convite.status = 'Aceito' and not exists (
      select 1 from public.confirmacoes cf where cf.convite_id = v_convite.id
    )
  );

  return v_resultado;
end;
$$;

revoke execute on function public.consultar_convite_publico(uuid) from public;
grant execute on function public.consultar_convite_publico(uuid) to anon, authenticated;

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
    update public.convites set status = 'Expirado' where id = v_convite.id;
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

revoke execute on function public.responder_convite_publico(uuid, boolean, date, uuid) from public;
grant execute on function public.responder_convite_publico(uuid, boolean, date, uuid) to anon, authenticated;

create or replace function public.enviar_confirmacao_convite_publico(
  p_token uuid,
  p_cantico_inicial varchar,
  p_utilizara_imagens boolean,
  p_permanecera_ate_final boolean,
  p_observacoes text,
  p_anexos jsonb default '[]'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
begin
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null or v_convite.status <> 'Aceito' then
    raise exception 'convite_invalido';
  end if;
  if exists (select 1 from public.confirmacoes where convite_id = v_convite.id) then
    raise exception 'confirmacao_ja_enviada';
  end if;
  if not p_permanecera_ate_final then
    raise exception 'permanencia_obrigatoria';
  end if;

  insert into public.confirmacoes (convite_id, cantico_inicial, utilizara_imagens, permanecera_ate_final, observacoes, anexos)
  values (v_convite.id, p_cantico_inicial, p_utilizara_imagens, p_permanecera_ate_final, p_observacoes, p_anexos);

  insert into public.historicos (programacao_id, usuario_id, tipo, descricao, dados)
  values (v_convite.programacao_id, null, 'convite_confirmado', 'Confirmação enviada pelo orador',
          jsonb_build_object('convite_id', v_convite.id));
end;
$$;

revoke execute on function public.enviar_confirmacao_convite_publico(uuid, varchar, boolean, boolean, text, jsonb) from public;
grant execute on function public.enviar_confirmacao_convite_publico(uuid, varchar, boolean, boolean, text, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------
-- 10. Storage — anexos de Confirmação (RN-072, primeiro uso de Storage)
-- -----------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('convite-anexos', 'convite-anexos', false);

create policy convite_anexos_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'convite-anexos'
    and exists (
      select 1 from public.convites c
      where c.token::text = (storage.foldername(name))[1] and c.status = 'Aceito'
    )
  );

create policy convite_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'convite-anexos'
    and exists (
      select 1 from public.convites c
      join public.programacoes p on p.id = c.programacao_id
      where c.token::text = (storage.foldername(name))[1]
        and (public.is_administrador_global() or p.congregacao_id = public.current_usuario_congregacao_id())
    )
  );
