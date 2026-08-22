# Convites — Convite de Orador via Link Público Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a equipe (Coordenador/Editor/Administrador Global) crie e envie Convites de discurso a um Orador oferecendo datas candidatas, e que o Orador responda (aceitar/recusar/confirmar dados do discurso) por um link público com token, sem login — cobrindo os 7 Casos de Uso de `06.1.6 - Convites.md`.

**Architecture:** `convites` (já existe) é desacoplado de uma Programação pré-existente — ganha `congregacao_id`/`token`/`expira_em`/`criado_por`, `programacao_id` vira nulo até o Orador aceitar. Uma tabela nova `convite_datas` guarda as datas candidatas oferecidas; um trigger impede a mesma data em dois convites abertos da mesma congregação. Três RPCs `security definer` concedidas ao papel `anon` (ADR-011) atendem o link público: consultar o convite, responder (aceitar cria a Programação nesse momento/recusar) e enviar a Confirmação (RN-070 a RN-073), com upload de anexos direto pro Storage antes de chamar a RPC. Do lado da equipe, um hook `useConvites` (mesmo padrão de `useProgramacoes`/`useOradores`) cobre criar/enviar/reenviar/cancelar; do lado público, `useConvitePublico` chama as RPCs direto, sem `useAuth`. `CalendarioMensal` ganha um modo de seleção múltipla (reaproveitado, não duplicado) para escolher as datas candidatas.

**Tech Stack:** Expo Router (web + native), React Native + NativeWind, Supabase (Postgres + RLS + PostgREST + Storage), TypeScript, `react-native-element-dropdown` (já usado no projeto). Upload de anexos via `<input type="file">` nativo do navegador (arquivo `.web.tsx`, sem nova dependência — o link público é aberto quase sempre num navegador mobile, não no app Expo).

**Spec:** `frontend/docs/superpowers/specs/2026-08-21-convites-design.md`

## Global Constraints

- Trabalhar com o conteúdo de RN-060 a RN-064 (Convites) e RN-070 a RN-073 (Confirmação) — não RN-050/051/054, que `06.1.6` referencia por engano (ver spec, "Contexto", Achado 1).
- Nenhuma autenticação nas RPCs de resposta ao convite (`consultar_convite_publico`, `responder_convite_publico`, `enviar_confirmacao_convite_publico`) — a identidade é a posse do token da URL (ADR-011, ver spec Achado 2 e "Decisão de segurança").
- Datas candidatas: nenhuma pode se repetir entre convites simultaneamente abertos (`Criado`/`Enviado`) da mesma congregação — trigger no banco, não só validação de UI.
- Temas: um tema já usado por outra Programação futura e não cancelada da mesma congregação some da lista oferecida ao Orador, até essa Programação ser realizada/cancelada/arquivada — checado nas RPCs, não só no client.
- Sem edição de resposta já enviada (trocar data/tema aceitos, ou editar a Confirmação já enviada) — se o Orador errou, a equipe cancela e cria um novo convite (mesmo espírito de "não reabrir" já usado em Suporte).
- Sem notificação in-app, sem reenvio automático/lembrete de expiração, sem UC-ORA-007/portal autenticado do Orador — fora de escopo (ver spec, "Não-objetivos").
- `historicos.usuario_id` fica sempre `null` nos logs desta fatia (mesma convenção das fatias anteriores — nenhum hook do projeto grava "quem executou"). Toda linha de histórico relacionada a Convite grava `dados: { convite_id: <uuid> }`, mesmo quando `programacao_id` também está setado — é o que permite ler o histórico completo de um convite com um único filtro (`dados->>convite_id`), antes e depois do aceite.
- Sem framework de testes automatizado — verificação manual: `cd frontend && npx tsc --noEmit`, `npx expo lint` (só conferir que os arquivos tocados não introduzem erros novos) e teste ao vivo no navegador via Playwright, seguindo o roteiro do spec ("Plano de verificação").
- Nunca fazer hard delete — cancelar é uma mudança de status, não uma exclusão. Nenhuma policy de DELETE é criada em nenhuma tabela desta fatia.
- Achados corrigidos nesta implementação em relação ao texto literal do spec (documentados na migração, Task 1): (a) `convites.criado_por` não existia no spec original — sem ele, a Programação criada pela RPC pública (sem usuário autenticado) não teria um `criado_por` válido (`NOT NULL`); (b) `convites_select`/`historicos_select` (RLS) ainda dependiam de `programacao_id`, que agora é nulo até o aceite — a equipe não veria convites `Criado`/`Enviado` nem seu histórico; (c) `responder_convite_publico` não tratava a colisão entre a data escolhida pelo Orador e uma Programação já criada fora do fluxo de Convites (mesma congregação/data) — agora captura e devolve um erro amigável em vez de estourar a exceção crua do Postgres.

---

### Task 1: Migração de banco — schema, triggers, RLS, RPCs públicas e Storage

**Files:**
- Create: `database/migrations/20260821140000_convites_link_publico.sql`

**Interfaces:**
- Produces: colunas novas em `convites` (`congregacao_id`, `token`, `expira_em`, `criado_por`, `programacao_id` agora nulo); tabela `convite_datas(id, convite_id, data, criado_em)`; coluna `confirmacoes.anexos jsonb`; RPCs `consultar_convite_publico(p_token uuid) returns jsonb`, `responder_convite_publico(p_token uuid, p_recusar boolean, p_data date, p_tema_id uuid) returns jsonb`, `enviar_confirmacao_convite_publico(p_token uuid, p_cantico_inicial varchar, p_utilizara_imagens boolean, p_permanecera_ate_final boolean, p_observacoes text, p_anexos jsonb) returns void`, todas concedidas a `anon, authenticated`. Bucket de Storage `convite-anexos` (privado), path `{token}/{nome_arquivo}`. Tasks 3, 4, 6, 7, 8, 9 dependem deste schema.

- [ ] **Step 1: Escrever a migração**

Crie `database/migrations/20260821140000_convites_link_publico.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase (`imeoyetcbjlkrxubwldv`)**

Use `mcp__claude_ai_Supabase__apply_migration` com `project_id: imeoyetcbjlkrxubwldv`, `name: convites_link_publico`, `query`: o conteúdo do arquivo do Step 1.

- [ ] **Step 3: Verificar schema, triggers e RPCs**

Rode via `mcp__claude_ai_Supabase__execute_sql` (`project_id: imeoyetcbjlkrxubwldv`):

```sql
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'convites'
  and column_name in ('congregacao_id', 'token', 'expira_em', 'criado_por', 'programacao_id');

select count(*) as total from information_schema.tables
where table_schema = 'public' and table_name = 'convite_datas';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'confirmacoes' and column_name = 'anexos';

select tgname from pg_trigger
where tgrelid in ('public.convite_datas'::regclass, 'public.confirmacoes'::regclass)
  and tgname in ('convite_datas_verifica_exclusividade', 'confirmacao_confirma_programacao');

select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('consultar_convite_publico', 'responder_convite_publico', 'enviar_confirmacao_convite_publico');

select grantee, routine_name from information_schema.role_routine_grants
where routine_schema = 'public' and grantee = 'anon'
  and routine_name in ('consultar_convite_publico', 'responder_convite_publico', 'enviar_confirmacao_convite_publico');

select id from storage.buckets where id = 'convite-anexos';
```

Esperado: `programacao_id` com `is_nullable = 'YES'`, as outras 4 colunas presentes; `convite_datas` com `total = 1`; `confirmacoes.anexos` presente; os 2 triggers listados; as 3 RPCs listadas; os 3 grants para `anon` listados; o bucket `convite-anexos` presente.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/20260821140000_convites_link_publico.sql
git commit -m "feat(convites): schema, RLS, RPCs publicas e storage para convite via link"
```

---

### Task 2: `CalendarioMensal` — modo de seleção múltipla

**Files:**
- Modify: `frontend/src/components/calendario-mensal.tsx`

**Interfaces:**
- Produces: adiciona `diasSelecionados?: Set<string>` a `CalendarioMensalProps` — quando presente, o destaque visual de cada dia usa `diasSelecionados.has(dataIso)` em vez de `diaSelecionado === dataIso` (retrocompatível: chamadas existentes em `programacao-form.tsx` e `(app)/programacoes/index.tsx`, que só passam `diaSelecionado`, continuam funcionando sem alteração). Task 6 (`convites/novo.tsx`) usa `diasSelecionados` para permitir marcar várias datas candidatas, alternando cada uma via `onSelecionarDia`.

- [ ] **Step 1: Adicionar a prop e o destaque múltiplo**

Em `frontend/src/components/calendario-mensal.tsx`, altere o tipo das props (linha 11-18):

```tsx
export type CalendarioMensalProps = {
  ano: number;
  mes: number;
  diasComEvento?: Set<string>;
  diaSelecionado?: string | null;
  diasSelecionados?: Set<string>;
  onSelecionarDia: (dataIso: string) => void;
  onMudarMes: (ano: number, mes: number) => void;
};
```

E a assinatura da função + o cálculo de `selecionado` dentro do `.map` de dias:

```tsx
export function CalendarioMensal({
  ano,
  mes,
  diasComEvento,
  diaSelecionado,
  diasSelecionados,
  onSelecionarDia,
  onMudarMes,
}: CalendarioMensalProps) {
```

```tsx
            const dataIso = paraIso(ano, mes, dia);
            const temEvento = diasComEvento?.has(dataIso) ?? false;
            const selecionado = diasSelecionados ? diasSelecionados.has(dataIso) : diaSelecionado === dataIso;
```

O resto do arquivo (JSX, `formatarDataIso`, `gerarSemanas`, `styles`) fica igual.

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `calendario-mensal.tsx` nem aos arquivos que já o consomem (`programacao-form.tsx`, `(app)/programacoes/index.tsx`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/calendario-mensal.tsx
git commit -m "feat(convites): modo de selecao multipla no CalendarioMensal"
```

---

### Task 3: Hooks `useConvites` e `useHistoricoConvite` (lado equipe)

**Files:**
- Create: `frontend/src/features/convites/use-convites.ts`
- Create: `frontend/src/features/convites/use-historico-convite.ts`

**Interfaces:**
- Consumes: `useAuth()` (`usuario.id`, `usuario.congregacao_id`); `supabase` de `@/lib/supabase`.
- Produces: `export type Convite = { id: string; congregacao_id: string; orador_id: string; orador: { id: string; nome: string; sobrenome: string }; programacao_id: string | null; status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado'; token: string; expira_em: string; enviado_em: string | null; respondido_em: string | null; cancelado_em: string | null; criado_por: string; convite_datas: { id: string; data: string }[]; confirmacoes: ConfirmacaoConvite[] }`; `export type ConfirmacaoConvite = { id: string; cantico_inicial: string | null; utilizara_imagens: boolean | null; permanecera_ate_final: boolean | null; observacoes: string | null; anexos: { caminho: string; nome_arquivo: string }[]; enviada_em: string }`; `export function useConvites()` retornando `{ status: 'loading' | 'ready' | 'error', convites: Convite[], criarConvite: (input: { oradorId: string; congregacaoId: string; datas: string[] }) => Promise<{ error: string | null; convite: Convite | null }>, enviarConvite: (convite: Convite) => Promise<{ error: string | null }>, reenviarConvite: (convite: Convite) => Promise<{ error: string | null }>, cancelarConvite: (convite: Convite) => Promise<{ error: string | null }> }`; `export function useHistoricoConvite(conviteId: string)` retornando `{ status: 'loading' | 'ready' | 'error', eventos: { id: string; tipo: string; descricao: string; dados: Record<string, unknown> | null; criado_em: string }[] }`. Tasks 6, 7, 8 consomem esses símbolos exatamente com esses nomes/tipos.

- [ ] **Step 1: Criar `use-convites.ts`**

Crie `frontend/src/features/convites/use-convites.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type ConfirmacaoConvite = {
  id: string;
  cantico_inicial: string | null;
  utilizara_imagens: boolean | null;
  permanecera_ate_final: boolean | null;
  observacoes: string | null;
  anexos: { caminho: string; nome_arquivo: string }[];
  enviada_em: string;
};

export type Convite = {
  id: string;
  congregacao_id: string;
  orador_id: string;
  orador: { id: string; nome: string; sobrenome: string };
  programacao_id: string | null;
  status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado';
  token: string;
  expira_em: string;
  enviado_em: string | null;
  respondido_em: string | null;
  cancelado_em: string | null;
  criado_por: string;
  convite_datas: { id: string; data: string }[];
  confirmacoes: ConfirmacaoConvite[];
};

export type ConvitesStatus = 'loading' | 'ready' | 'error';

const CONVITES_SELECT =
  'id, congregacao_id, orador_id, orador:oradores(id, nome, sobrenome), programacao_id, status, token, ' +
  'expira_em, enviado_em, respondido_em, cancelado_em, criado_por, convite_datas(id, data), ' +
  'confirmacoes(id, cantico_inicial, utilizara_imagens, permanecera_ate_final, observacoes, anexos, enviada_em)';

const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';
const ERRO_SEM_DATAS = 'Selecione ao menos uma data candidata.';
const ERRO_DATA_OFERTADA = 'Uma ou mais datas já estão em outro convite aberto.';
const ERRO_JA_FINALIZADO = 'Este convite já foi respondido, cancelado ou expirou.';

export function useConvites() {
  const { usuario } = useAuth();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [status, setStatus] = useState<ConvitesStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('convites')
      .select(CONVITES_SELECT)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setConvites((data ?? []) as unknown as Convite[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarConvite(input: {
    oradorId: string;
    congregacaoId: string;
    datas: string[];
  }): Promise<{ error: string | null; convite: Convite | null }> {
    if (!usuario) return { error: ERRO_SALVAR, convite: null };
    if (input.datas.length === 0) return { error: ERRO_SEM_DATAS, convite: null };

    const { data: conviteCriado, error: conviteError } = await supabase
      .from('convites')
      .insert({ congregacao_id: input.congregacaoId, orador_id: input.oradorId, criado_por: usuario.id })
      .select('id')
      .single();

    if (conviteError || !conviteCriado) return { error: ERRO_SALVAR, convite: null };

    const { error: datasError } = await supabase
      .from('convite_datas')
      .insert(input.datas.map((data) => ({ convite_id: conviteCriado.id, data })));

    if (datasError) {
      // Convite já existe sem nenhuma data candidata — não há policy de DELETE
      // (projeto nunca faz hard delete), então marcamos Cancelado em vez de
      // deixar um convite "Criado" fantasma na lista.
      await supabase
        .from('convites')
        .update({ status: 'Cancelado', cancelado_em: new Date().toISOString() })
        .eq('id', conviteCriado.id);

      if (datasError.message.includes('data_ja_ofertada')) return { error: ERRO_DATA_OFERTADA, convite: null };
      return { error: ERRO_SALVAR, convite: null };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'convite_criado',
      descricao: 'Convite criado',
      dados: { convite_id: conviteCriado.id },
    });

    await carregar();

    const { data: completo } = await supabase
      .from('convites')
      .select(CONVITES_SELECT)
      .eq('id', conviteCriado.id)
      .single();

    return { error: null, convite: (completo ?? null) as unknown as Convite | null };
  }

  async function enviarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const { error } = await supabase
      .from('convites')
      .update({ status: 'Enviado', enviado_em: new Date().toISOString() })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_enviado',
      descricao: 'Convite enviado ao orador',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  async function reenviarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const novaExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('convites')
      .update({ status: 'Enviado', expira_em: novaExpiracao })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_reenviado',
      descricao: 'Convite reenviado ao orador',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  async function cancelarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };
    if (['Recusado', 'Cancelado', 'Expirado'].includes(convite.status)) return { error: ERRO_JA_FINALIZADO };

    const { error } = await supabase
      .from('convites')
      .update({ status: 'Cancelado', cancelado_em: new Date().toISOString() })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    if (convite.programacao_id) {
      await supabase.from('programacoes').update({ status: 'Cancelada' }).eq('id', convite.programacao_id);
      await supabase.from('historicos').insert({
        programacao_id: convite.programacao_id,
        usuario_id: null,
        tipo: 'programacao_cancelada',
        descricao: 'Programação cancelada (convite cancelado)',
      });
    }

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_cancelado',
      descricao: 'Convite cancelado',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  return { status, convites, criarConvite, enviarConvite, reenviarConvite, cancelarConvite };
}
```

- [ ] **Step 2: Criar `use-historico-convite.ts`**

Crie `frontend/src/features/convites/use-historico-convite.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistoricoConvite = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoConviteStatus = 'loading' | 'ready' | 'error';

export function useHistoricoConvite(conviteId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistoricoConvite[]>([]);
  const [status, setStatus] = useState<HistoricoConviteStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !conviteId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('dados->>convite_id', conviteId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistoricoConvite[]);
    setStatus('ready');
  }, [usuario?.id, conviteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
```

- [ ] **Step 3: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados aos dois arquivos criados.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/convites/use-convites.ts frontend/src/features/convites/use-historico-convite.ts
git commit -m "feat(convites): hooks useConvites e useHistoricoConvite"
```

---

### Task 4: Hook `useConvitePublico` (lado Orador, sem login)

**Files:**
- Create: `frontend/src/features/convites/use-convite-publico.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase` (chamadas `supabase.rpc(...)` e `supabase.storage.from('convite-anexos')` diretas — **sem** `useAuth`, ver spec Achado 2).
- Produces: `export type TemaDisponivel = { tema_id: string; numero: string; titulo: string }`; `export type ConvitePublico = { status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado'; orador_nome: string; congregacao_nome: string; datas_candidatas: string[]; temas_disponiveis: TemaDisponivel[] | null; confirmacao_pendente: boolean }`; `export function useConvitePublico(token: string)` retornando `{ status: 'loading' | 'ready' | 'error', convite: ConvitePublico | null, responderConvite: (input: { recusar: true } | { recusar: false; data: string; temaId: string }) => Promise<{ error: string | null }>, enviarConfirmacao: (input: { canticoInicial: string; utilizaraImagens: boolean; permanecereAteFinal: boolean; observacoes: string; anexos: { caminho: string; nome_arquivo: string }[] }) => Promise<{ error: string | null }>, uploadAnexo: (arquivo: File) => Promise<{ error: string | null; caminho: string | null }> }`. Task 9 (`convite/[token].tsx`) consome esses símbolos exatamente com esses nomes/tipos.

- [ ] **Step 1: Criar o hook**

Crie `frontend/src/features/convites/use-convite-publico.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type TemaDisponivel = { tema_id: string; numero: string; titulo: string };

export type ConvitePublico = {
  status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado';
  orador_nome: string;
  congregacao_nome: string;
  datas_candidatas: string[];
  temas_disponiveis: TemaDisponivel[] | null;
  confirmacao_pendente: boolean;
};

export type ConvitePublicoStatus = 'loading' | 'ready' | 'error';

const ERRO_GENERICO = 'Não foi possível enviar sua resposta. Tente novamente.';
const ERRO_CONVITE_INVALIDO = 'Este link de convite não é válido.';
const ERRO_CONVITE_EXPIRADO = 'Este convite expirou. Peça à congregação um novo link.';
const ERRO_TEMA_INDISPONIVEL = 'Este tema não está mais disponível. Escolha outro.';
const ERRO_DATA_INDISPONIVEL = 'Esta data não está mais disponível. Escolha outra.';
const ERRO_CONFIRMACAO_ENVIADA = 'A confirmação para este convite já foi enviada.';
const ERRO_PERMANENCIA = 'É necessário confirmar que permanecerá até o final da reunião.';

function mapearErroRpc(mensagem: string): string {
  if (mensagem.includes('convite_invalido')) return ERRO_CONVITE_INVALIDO;
  if (mensagem.includes('convite_expirado')) return ERRO_CONVITE_EXPIRADO;
  if (mensagem.includes('tema_invalido') || mensagem.includes('tema_indisponivel')) return ERRO_TEMA_INDISPONIVEL;
  if (mensagem.includes('data_invalida') || mensagem.includes('data_indisponivel')) return ERRO_DATA_INDISPONIVEL;
  if (mensagem.includes('confirmacao_ja_enviada')) return ERRO_CONFIRMACAO_ENVIADA;
  if (mensagem.includes('permanencia_obrigatoria')) return ERRO_PERMANENCIA;
  return ERRO_GENERICO;
}

export function useConvitePublico(token: string) {
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [status, setStatus] = useState<ConvitePublicoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!token) return;

    setStatus('loading');
    const { data, error } = await supabase.rpc('consultar_convite_publico', { p_token: token });

    if (error || !data) {
      setStatus('error');
      return;
    }

    setConvite(data as unknown as ConvitePublico);
    setStatus('ready');
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responderConvite(
    input: { recusar: true } | { recusar: false; data: string; temaId: string }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('responder_convite_publico', {
      p_token: token,
      p_recusar: input.recusar,
      p_data: input.recusar ? null : input.data,
      p_tema_id: input.recusar ? null : input.temaId,
    });

    if (error) return { error: mapearErroRpc(error.message) };
    await carregar();
    return { error: null };
  }

  async function enviarConfirmacao(input: {
    canticoInicial: string;
    utilizaraImagens: boolean;
    permanecereAteFinal: boolean;
    observacoes: string;
    anexos: { caminho: string; nome_arquivo: string }[];
  }): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('enviar_confirmacao_convite_publico', {
      p_token: token,
      p_cantico_inicial: input.canticoInicial || null,
      p_utilizara_imagens: input.utilizaraImagens,
      p_permanecera_ate_final: input.permanecereAteFinal,
      p_observacoes: input.observacoes || null,
      p_anexos: input.anexos,
    });

    if (error) return { error: mapearErroRpc(error.message) };
    await carregar();
    return { error: null };
  }

  async function uploadAnexo(arquivo: File): Promise<{ error: string | null; caminho: string | null }> {
    const caminho = `${token}/${Date.now()}_${arquivo.name}`;
    const { error } = await supabase.storage.from('convite-anexos').upload(caminho, arquivo);

    if (error) return { error: ERRO_GENERICO, caminho: null };
    return { error: null, caminho };
  }

  return { status, convite, responderConvite, enviarConfirmacao, uploadAnexo };
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `use-convite-publico.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/convites/use-convite-publico.ts
git commit -m "feat(convites): hook useConvitePublico para resposta sem login"
```

---

### Task 5: Componente `AnexoUpload` (seleção de arquivo, só web)

**Files:**
- Create: `frontend/src/components/anexo-upload.tsx`
- Create: `frontend/src/components/anexo-upload.web.tsx`

**Interfaces:**
- Produces: `export type AnexoUploadProps = { onArquivosSelecionados: (arquivos: File[]) => void; desabilitado?: boolean }`; `export function AnexoUpload(props: AnexoUploadProps)`. Task 9 consome esse símbolo — Metro/Expo resolve automaticamente `anexo-upload.web.tsx` na Web e `anexo-upload.tsx` em iOS/Android (mesma técnica já usada em `animated-icon.web.tsx`/`app-tabs.web.tsx`).

- [ ] **Step 1: Criar o fallback nativo**

Crie `frontend/src/components/anexo-upload.tsx`:

```tsx
import { Text, View } from 'react-native';

export type AnexoUploadProps = {
  onArquivosSelecionados: (arquivos: File[]) => void;
  desabilitado?: boolean;
};

export function AnexoUpload({}: AnexoUploadProps) {
  return (
    <View className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
      <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        Envio de anexos disponível apenas no navegador.
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Criar a versão web**

Crie `frontend/src/components/anexo-upload.web.tsx`:

```tsx
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

export type AnexoUploadProps = {
  onArquivosSelecionados: (arquivos: File[]) => void;
  desabilitado?: boolean;
};

export function AnexoUpload({ onArquivosSelecionados, desabilitado }: AnexoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <View>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(evento) => {
          const arquivos = evento.target.files ? Array.from(evento.target.files) : [];
          if (arquivos.length > 0) onArquivosSelecionados(arquivos);
          evento.target.value = '';
        }}
      />
      <Pressable
        onPress={() => inputRef.current?.click()}
        disabled={desabilitado}
        className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Anexar arquivo</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados aos dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/anexo-upload.tsx frontend/src/components/anexo-upload.web.tsx
git commit -m "feat(convites): componente AnexoUpload para a confirmacao publica"
```

---

### Task 6: Rotas `(app)/convites/_layout.tsx` e `novo.tsx`

**Files:**
- Create: `frontend/src/app/(app)/convites/_layout.tsx`
- Create: `frontend/src/app/(app)/convites/novo.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useTheme()`, `useOradores()` (`oradores`), `useConvites()` (`criarConvite`), `CalendarioMensal`/`formatarDataIso` de `@/components/calendario-mensal` (modo `diasSelecionados`, Task 2), `DropdownSearchInput`/`encontrarPrimeiraCorrespondencia`, `DropdownHoverItem`, `supabase` (para listar congregações quando Administrador Global).
- Produces: tela acessível em `/convites/novo`. Task 7 navega para cá via `router.push('/convites/novo')`.

- [ ] **Step 1: Criar o layout da seção**

Crie `frontend/src/app/(app)/convites/_layout.tsx` (mesmo padrão de `(app)/programacoes/_layout.tsx` e `(app)/oradores/_layout.tsx` — sem essa camada, a navegação entre `index`/`[id]`/`novo` dentro da aba quebra silenciosamente):

```tsx
import { Stack } from 'expo-router';

export default function ConvitesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Criar a tela `novo.tsx`**

Crie `frontend/src/app/(app)/convites/novo.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useOradores } from '@/features/oradores/use-oradores';
import { useConvites } from '@/features/convites/use-convites';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { DropdownHoverItem } from '@/components/dropdown-hover-item';

const ERRO_CAMPOS = 'Selecione um orador e ao menos uma data candidata.';

type CongregacaoOpcao = { id: string; nome: string; numero: string };

export default function NovoConviteScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { oradores } = useOradores();
  const { criarConvite } = useConvites();

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  const oradorRef = useRef<IDropdownRef>(null);
  const congregacaoRef = useRef<IDropdownRef>(null);
  const [oradorId, setOradorId] = useState('');
  const [oradorBusca, setOradorBusca] = useState('');
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [congregacaoId, setCongregacaoId] = useState(ehAdministradorGlobal ? '' : (usuario?.congregacao_id ?? ''));
  const [congregacaoBusca, setCongregacaoBusca] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const hoje = new Date();
  const [anoCalendario, setAnoCalendario] = useState(hoje.getFullYear());
  const [mesCalendario, setMesCalendario] = useState(hoje.getMonth());

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
    let ignorar = false;
    supabase
      .from('congregacoes')
      .select('id, nome, numero')
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCongregacoes((data ?? []) as CongregacaoOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, [ehAdministradorGlobal]);

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const oradorOpcoes = oradores.filter((o) => o.ativo).map((o) => ({ id: o.id, label: `${o.nome} ${o.sobrenome}` }));
  const congregacaoOpcoes = congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }));

  function alternarData(dataIso: string) {
    setDiasSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(dataIso)) proximo.delete(dataIso);
      else proximo.add(dataIso);
      return proximo;
    });
  }

  async function handleSalvar() {
    setErro(null);
    if (!oradorId || !congregacaoId || diasSelecionados.size === 0) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setSalvando(true);
    const { error, convite } = await criarConvite({
      oradorId,
      congregacaoId,
      datas: Array.from(diasSelecionados),
    });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }
    if (convite) router.replace(`/convites/${convite.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Novo Convite</Text>

          {ehAdministradorGlobal ? (
            <Dropdown
              ref={congregacaoRef}
              style={dropdownStyle}
              containerStyle={{ backgroundColor: colors.background }}
              placeholderStyle={{ color: colors.textSecondary }}
              selectedTextStyle={{ color: colors.text }}
              itemTextStyle={{ color: colors.text }}
              inputSearchStyle={{ color: colors.text }}
              activeColor={colors.backgroundSelected}
              data={congregacaoOpcoes}
              labelField="label"
              valueField="id"
              value={congregacaoId}
              placeholder="Selecionar congregação"
              search
              searchPlaceholder="Buscar congregação..."
              onChangeText={setCongregacaoBusca}
              onChange={(item) => setCongregacaoId(item.id)}
              renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
              renderInputSearch={(onSearch) => (
                <DropdownSearchInput
                  value={congregacaoBusca}
                  onChangeText={onSearch}
                  onSubmitPrimeiraCorrespondencia={() => {
                    const primeiro = encontrarPrimeiraCorrespondencia(congregacaoOpcoes, 'label', congregacaoBusca);
                    if (primeiro) setCongregacaoId(primeiro.id);
                    congregacaoRef.current?.close();
                  }}
                  placeholder="Buscar congregação..."
                  placeholderTextColor={colors.textSecondary}
                  color={colors.text}
                />
              )}
            />
          ) : null}

          <Dropdown
            ref={oradorRef}
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            inputSearchStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={oradorOpcoes}
            labelField="label"
            valueField="id"
            value={oradorId}
            placeholder="Selecionar orador"
            search
            searchPlaceholder="Buscar orador..."
            onChangeText={setOradorBusca}
            onChange={(item) => setOradorId(item.id)}
            renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
            renderInputSearch={(onSearch) => (
              <DropdownSearchInput
                value={oradorBusca}
                onChangeText={onSearch}
                onSubmitPrimeiraCorrespondencia={() => {
                  const primeiro = encontrarPrimeiraCorrespondencia(oradorOpcoes, 'label', oradorBusca);
                  if (primeiro) setOradorId(primeiro.id);
                  oradorRef.current?.close();
                }}
                placeholder="Buscar orador..."
                placeholderTextColor={colors.textSecondary}
                color={colors.text}
              />
            )}
          />

          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            Datas candidatas (toque para selecionar mais de uma)
          </Text>
          <CalendarioMensal
            ano={anoCalendario}
            mes={mesCalendario}
            diasSelecionados={diasSelecionados}
            onSelecionarDia={alternarData}
            onMudarMes={(ano, mes) => {
              setAnoCalendario(ano);
              setMesCalendario(mes);
            }}
          />

          {diasSelecionados.size > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {Array.from(diasSelecionados)
                .sort()
                .map((data) => (
                  <Pressable
                    key={data}
                    onPress={() => alternarData(data)}
                    className="flex-row items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-600">
                    <Text className="text-xs text-neutral-900 dark:text-white">{formatarDataIso(data)}</Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">×</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}

          {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

          <Pressable
            onPress={handleSalvar}
            disabled={salvando}
            className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {salvando ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-medium text-white dark:text-neutral-900">Criar Convite</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados aos dois arquivos.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(app)/convites/_layout.tsx" "frontend/src/app/(app)/convites/novo.tsx"
git commit -m "feat(convites): tela de criacao de convite com datas candidatas"
```

---

### Task 7: Rota `(app)/convites/index.tsx`

**Files:**
- Create: `frontend/src/app/(app)/convites/index.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useConvites()` (`status`, `convites`) de Task 3, `formatarDataIso` de `@/components/calendario-mensal`.
- Produces: tela acessível em `/convites`. Task 10 aponta a aba "Convites" para cá.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/convites/index.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { useConvites, type Convite } from '@/features/convites/use-convites';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const STATUS_FILTROS: (Convite['status'] | 'Todos')[] = [
  'Todos',
  'Criado',
  'Enviado',
  'Aceito',
  'Recusado',
  'Cancelado',
  'Expirado',
];

export default function ConvitesScreen() {
  const { usuario } = useAuth();
  const { status, convites } = useConvites();
  const [filtro, setFiltro] = useState<(typeof STATUS_FILTROS)[number]>('Todos');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const convitesFiltrados = filtro === 'Todos' ? convites : convites.filter((c) => c.status === filtro);

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os convites.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Convites</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {STATUS_FILTROS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFiltro(s)}
                  className={`items-center rounded-lg border px-3 py-2 ${filtro === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">{s}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {convitesFiltrados.length === 0 ? (
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum convite encontrado.</Text>
          ) : null}
          {convitesFiltrados.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/convites/${c.id}`)}
              className="gap-2 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
              <Text className="text-base font-medium text-neutral-900 dark:text-white">
                {c.orador.nome} {c.orador.sobrenome}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">{c.status}</Text>
            </Pressable>
          ))}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/convites/novo')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Convite</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `(app)/convites/index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/convites/index.tsx"
git commit -m "feat(convites): tela de listagem com filtro por status"
```

---

### Task 8: Rota `(app)/convites/[id].tsx`

**Files:**
- Create: `frontend/src/app/(app)/convites/[id].tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useConvites()` (`status`, `convites`, `enviarConvite`, `reenviarConvite`, `cancelarConvite`) de Task 3, `useHistoricoConvite()` de Task 3, `formatarDataIso` de `@/components/calendario-mensal`.
- Produces: tela acessível em `/convites/[id]`. Tasks 6, 7 navegam para cá.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/convites/[id].tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { useConvites, type Convite } from '@/features/convites/use-convites';
import { useHistoricoConvite } from '@/features/convites/use-historico-convite';
import { formatarDataIso } from '@/components/calendario-mensal';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

type Secao = 'dados' | 'historico';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function construirLinkConvite(token: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/convite/${token}`;
  }
  return `/convite/${token}`;
}

export default function ConviteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const { status, convites, enviarConvite, reenviarConvite, cancelarConvite } = useConvites();
  const convite = convites.find((c) => c.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');
  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !convite) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os convites.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {convite.orador.nome} {convite.orador.sobrenome}
          </Text>

          <View className="flex-row gap-3">
            {(['dados', 'historico'] as Secao[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSecao(s)}
                className={`flex-1 items-center rounded-lg border px-3 py-2 ${secao === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s === 'dados' ? 'Dados' : 'Histórico'}
                </Text>
              </Pressable>
            ))}
          </View>

          {secao === 'dados' ? (
            <SecaoDados
              convite={convite}
              podeGerenciar={podeGerenciar}
              enviarConvite={enviarConvite}
              reenviarConvite={reenviarConvite}
              cancelarConvite={cancelarConvite}
            />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico conviteId={convite.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  convite,
  podeGerenciar,
  enviarConvite,
  reenviarConvite,
  cancelarConvite,
}: {
  convite: Convite;
  podeGerenciar: boolean;
  enviarConvite: ReturnType<typeof useConvites>['enviarConvite'];
  reenviarConvite: ReturnType<typeof useConvites>['reenviarConvite'];
  cancelarConvite: ReturnType<typeof useConvites>['cancelarConvite'];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const link = construirLinkConvite(convite.token);
  const podeEnviar = podeGerenciar && convite.status === 'Criado';
  const podeReenviar = podeGerenciar && (convite.status === 'Enviado' || convite.status === 'Expirado');
  const podeCancelar = podeGerenciar && !['Recusado', 'Cancelado', 'Expirado'].includes(convite.status);
  const aceitoSemConfirmacao = convite.status === 'Aceito' && convite.confirmacoes.length === 0;
  const confirmacao = convite.confirmacoes[0] ?? null;

  async function handleCopiar() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  async function handleEnviar() {
    setErro(null);
    setProcessando(true);
    const { error } = await enviarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleReenviar() {
    setErro(null);
    setProcessando(true);
    const { error } = await reenviarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleCancelar() {
    setErro(null);
    setProcessando(true);
    const { error } = await cancelarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  return (
    <View className="gap-4">
      <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Status</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {convite.status}
            {aceitoSemConfirmacao ? ' — dados pendentes' : ''}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Datas candidatas</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {convite.convite_datas.map((d) => formatarDataIso(d.data)).join(', ')}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Link de resposta</Text>
          <Text className="text-sm text-neutral-900 dark:text-white" selectable>
            {link}
          </Text>
          <Pressable onPress={handleCopiar} className="mt-2 items-start">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">
              {copiado ? 'Copiado!' : 'Copiar link'}
            </Text>
          </Pressable>
        </View>
      </View>

      {confirmacao ? (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Confirmação recebida</Text>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cântico inicial</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.cantico_inicial || 'Não informado'}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Uso de imagens</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.utilizara_imagens ? 'Sim' : 'Não'}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Permanência até o final</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.permanecera_ate_final ? 'Confirmada' : 'Não confirmada'}
            </Text>
          </View>
          {confirmacao.observacoes ? (
            <View>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Observações</Text>
              <Text className="text-base text-neutral-900 dark:text-white">{confirmacao.observacoes}</Text>
            </View>
          ) : null}
          {confirmacao.anexos.length > 0 ? (
            <View>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Anexos</Text>
              {confirmacao.anexos.map((anexo) => (
                <Text key={anexo.caminho} className="text-sm text-neutral-900 dark:text-white">
                  {anexo.nome_arquivo}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {podeEnviar ? (
        <Pressable
          onPress={handleEnviar}
          disabled={processando}
          className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Enviar</Text>
          )}
        </Pressable>
      ) : null}

      {podeReenviar ? (
        <Pressable
          onPress={handleReenviar}
          disabled={processando}
          className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Reenviar</Text>
          )}
        </Pressable>
      ) : null}

      {podeCancelar ? (
        <Pressable
          onPress={handleCancelar}
          disabled={processando}
          className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Cancelar Convite</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ conviteId }: { conviteId: string }) {
  const { status, eventos } = useHistoricoConvite(conviteId);

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  if (eventos.length === 0) {
    return <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum evento registrado ainda.</Text>;
  }

  return (
    <View className="gap-3">
      {eventos.map((e) => (
        <View key={e.id} className="gap-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">{e.descricao}</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{formatarDataHora(e.criado_em)}</Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `(app)/convites/[id].tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/convites/[id].tsx"
git commit -m "feat(convites): tela de detalhe com acoes e confirmacao recebida"
```

---

### Task 9: Rota pública `convite/[token].tsx`

**Files:**
- Create: `frontend/src/app/convite/[token].tsx`

**Interfaces:**
- Consumes: `useConvitePublico(token)` de Task 4, `AnexoUpload` de Task 5, `formatarDataIso` de `@/components/calendario-mensal`. **Não** usa `useAuth` (tela sempre pública, ver spec Achado 2).
- Produces: tela acessível em `/convite/{token}`, fora do grupo `(app)`. Task 10 registra a rota no `Stack` raiz.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/convite/[token].tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { MaxContentWidth } from '@/constants/theme';
import { useConvitePublico, type ConvitePublico } from '@/features/convites/use-convite-publico';
import { formatarDataIso } from '@/components/calendario-mensal';
import { AnexoUpload } from '@/components/anexo-upload';

const ERRO_CAMPOS_FASE1 = 'Escolha uma data e um tema.';
const ERRO_PERMANENCIA = 'É necessário confirmar que permanecerá até o final da reunião.';

export default function ConvitePublicoScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, convite, responderConvite, enviarConfirmacao, uploadAnexo } = useConvitePublico(token ?? '');

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !convite) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar este convite.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth }}>
          {convite.status === 'Criado' || convite.status === 'Enviado' ? (
            <Fase1 convite={convite} responderConvite={responderConvite} />
          ) : null}

          {convite.status === 'Aceito' && convite.confirmacao_pendente ? (
            <Fase2 enviarConfirmacao={enviarConfirmacao} uploadAnexo={uploadAnexo} />
          ) : null}

          {convite.status === 'Aceito' && !convite.confirmacao_pendente ? (
            <View style={{ gap: 12 }}>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Confirmado, obrigado!</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                Já recebemos os dados do seu discurso.
              </Text>
            </View>
          ) : null}

          {convite.status === 'Recusado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Você recusou este convite. Obrigado por avisar!
            </Text>
          ) : null}

          {convite.status === 'Cancelado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Este convite foi cancelado pela congregação.
            </Text>
          ) : null}

          {convite.status === 'Expirado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Este convite expirou. Peça à congregação um novo link.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fase1({
  convite,
  responderConvite,
}: {
  convite: ConvitePublico;
  responderConvite: ReturnType<typeof useConvitePublico>['responderConvite'];
}) {
  const [dataEscolhida, setDataEscolhida] = useState<string | null>(null);
  const [temaId, setTemaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleRecusar() {
    setErro(null);
    setEnviando(true);
    const { error } = await responderConvite({ recusar: true });
    setEnviando(false);
    if (error) setErro(error);
  }

  async function handleConfirmarDisponibilidade() {
    setErro(null);
    if (!dataEscolhida || !temaId) {
      setErro(ERRO_CAMPOS_FASE1);
      return;
    }
    setEnviando(true);
    const { error } = await responderConvite({ recusar: false, data: dataEscolhida, temaId });
    setEnviando(false);
    if (error) setErro(error);
  }

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Convite para Discurso Público</Text>
      <Text className="text-base text-neutral-900 dark:text-white">
        Olá, {convite.orador_nome}! A congregação {convite.congregacao_nome} gostaria de convidá-lo(a).
      </Text>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Escolha uma data:</Text>
        {convite.datas_candidatas.map((data) => (
          <Pressable
            key={data}
            onPress={() => setDataEscolhida(data)}
            className={`rounded-lg border px-4 py-3 ${dataEscolhida === data ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-neutral-900 dark:text-white">{formatarDataIso(data)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Escolha um tema preparado:</Text>
        {(convite.temas_disponiveis ?? []).length === 0 ? (
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum tema preparado disponível no momento.
          </Text>
        ) : (
          (convite.temas_disponiveis ?? []).map((tema) => (
            <Pressable
              key={tema.tema_id}
              onPress={() => setTemaId(tema.tema_id)}
              className={`rounded-lg border px-4 py-3 ${temaId === tema.tema_id ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-neutral-900 dark:text-white">
                {tema.numero}. {tema.titulo}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <Pressable
        onPress={handleConfirmarDisponibilidade}
        disabled={enviando}
        className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
        {enviando ? (
          <ActivityIndicator />
        ) : (
          <Text className="font-medium text-white dark:text-neutral-900">Confirmar disponibilidade</Text>
        )}
      </Pressable>

      <Pressable
        onPress={handleRecusar}
        disabled={enviando}
        className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
        <Text className="text-sm font-medium text-red-600 dark:text-red-400">Não posso nenhuma dessas datas</Text>
      </Pressable>
    </View>
  );
}

function Fase2({
  enviarConfirmacao,
  uploadAnexo,
}: {
  enviarConfirmacao: ReturnType<typeof useConvitePublico>['enviarConfirmacao'];
  uploadAnexo: ReturnType<typeof useConvitePublico>['uploadAnexo'];
}) {
  const [adiado, setAdiado] = useState(false);
  const [canticoInicial, setCanticoInicial] = useState('');
  const [utilizaraImagens, setUtilizaraImagens] = useState(false);
  const [permanecereAteFinal, setPermanecereAteFinal] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [anexos, setAnexos] = useState<{ caminho: string; nome_arquivo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAnexar(arquivos: File[]) {
    for (const arquivo of arquivos) {
      const { error, caminho } = await uploadAnexo(arquivo);
      if (!error && caminho) setAnexos((atual) => [...atual, { caminho, nome_arquivo: arquivo.name }]);
    }
  }

  function handleRemoverAnexo(caminho: string) {
    setAnexos((atual) => atual.filter((a) => a.caminho !== caminho));
  }

  async function handleEnviar() {
    setErro(null);
    if (!permanecereAteFinal) {
      setErro(ERRO_PERMANENCIA);
      return;
    }
    setEnviando(true);
    const { error } = await enviarConfirmacao({
      canticoInicial,
      utilizaraImagens,
      permanecereAteFinal,
      observacoes,
      anexos,
    });
    setEnviando(false);
    if (error) setErro(error);
  }

  if (adiado) {
    return (
      <View style={{ gap: 12 }}>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">Tudo certo por enquanto!</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          Você pode voltar a este mesmo link quando quiser terminar de enviar os dados do discurso.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Dados do Discurso</Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">
        Convite aceito! Agora precisamos de mais alguns detalhes.
      </Text>

      <TextInput
        value={canticoInicial}
        onChangeText={setCanticoInicial}
        placeholder="Cântico inicial (opcional)"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      <Pressable onPress={() => setUtilizaraImagens(!utilizaraImagens)} className="flex-row items-center gap-2">
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${utilizaraImagens ? 'bg-neutral-900 dark:bg-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
          {utilizaraImagens ? <Text className="text-xs text-white dark:text-neutral-900">✓</Text> : null}
        </View>
        <Text className="text-sm text-neutral-900 dark:text-white">Vou utilizar imagens no discurso</Text>
      </Pressable>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Anexos (opcional)</Text>
        <AnexoUpload onArquivosSelecionados={handleAnexar} />
        {anexos.map((anexo) => (
          <View
            key={anexo.caminho}
            className="flex-row items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <Text className="flex-1 text-sm text-neutral-900 dark:text-white" numberOfLines={1}>
              {anexo.nome_arquivo}
            </Text>
            <Pressable onPress={() => handleRemoverAnexo(anexo.caminho)}>
              <Text className="text-sm text-red-600 dark:text-red-400">Remover</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <TextInput
        value={observacoes}
        onChangeText={setObservacoes}
        placeholder="Observações (opcional)"
        multiline
        numberOfLines={3}
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      <Pressable onPress={() => setPermanecereAteFinal(!permanecereAteFinal)} className="flex-row items-center gap-2">
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${permanecereAteFinal ? 'bg-neutral-900 dark:bg-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
          {permanecereAteFinal ? <Text className="text-xs text-white dark:text-neutral-900">✓</Text> : null}
        </View>
        <Text className="text-sm text-neutral-900 dark:text-white">Confirmo que permanecerei até o final da reunião</Text>
      </Pressable>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <Pressable
        onPress={handleEnviar}
        disabled={enviando}
        className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
        {enviando ? (
          <ActivityIndicator />
        ) : (
          <Text className="font-medium text-white dark:text-neutral-900">Enviar confirmação</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setAdiado(true)}
        className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Responder depois</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `convite/[token].tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/convite/[token].tsx"
git commit -m "feat(convites): tela publica de resposta ao convite sem login"
```

---

### Task 10: Registrar rota pública e aba "Convites"

**Files:**
- Modify: `frontend/src/app/_layout.tsx`
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: nenhum símbolo novo — só registro de rotas/abas já criadas nas Tasks 6-9.
- Produces: `/convite/[token]` alcançável em qualquer `AuthStatus` (mesmo padrão de `aceitar-convite`); aba "Convites" visível em `(app)`, apontando para `/convites`.

- [ ] **Step 1: Registrar a rota pública no Stack raiz**

Em `frontend/src/app/_layout.tsx`, adicione a nova tela logo após o comentário existente sobre `aceitar-convite`:

```tsx
      {/* Sempre alcançável, independente do status — a própria tela decide
          o que renderizar por status (ver aceitar-convite.tsx). Precisa
          disso porque um convite de transferência é aceito por alguém já
          'authenticated', e um convite de conta nova por alguém em
          'onboarding' ou 'unauthenticated'. */}
      <Stack.Screen name="aceitar-convite" />
      {/* Também sempre alcançável — o Orador que responde a um Convite
          nunca tem sessão (link público com token, ver ADR-011). Precisa
          ficar fora de todo Stack.Protected para ser acessível em
          qualquer AuthStatus, igual a aceitar-convite. */}
      <Stack.Screen name="convite/[token]" />
```

- [ ] **Step 2: Adicionar a aba nativa**

Em `frontend/src/components/app-tabs.tsx`, adicione o trigger entre `programacoes` e `suporte`:

```tsx
      <NativeTabs.Trigger name="programacoes">
        <NativeTabs.Trigger.Label>Programações</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="convites">
        <NativeTabs.Trigger.Label>Convites</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="suporte">
        <NativeTabs.Trigger.Label>Suporte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```

- [ ] **Step 3: Adicionar a aba web**

Em `frontend/src/components/app-tabs.web.tsx`, adicione o `TabTrigger` entre `programacoes` e `suporte`:

```tsx
          <TabTrigger name="programacoes" href="/programacoes" asChild>
            <TabButton>Programações</TabButton>
          </TabTrigger>
          <TabTrigger name="convites" href="/convites" asChild>
            <TabButton>Convites</TabButton>
          </TabTrigger>
          <TabTrigger name="suporte" href="/suporte" asChild>
            <TabButton>Suporte</TabButton>
          </TabTrigger>
```

- [ ] **Step 4: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados aos três arquivos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/_layout.tsx frontend/src/components/app-tabs.tsx frontend/src/components/app-tabs.web.tsx
git commit -m "feat(convites): registrar rota publica e aba Convites"
```

---

### Task 11: Documentação — ADR-011 e `08-DER.md`

**Files:**
- Modify: `docs/13-ADR.md`
- Modify: `docs/08-DER.md`

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: Adicionar ADR-011**

Em `docs/13-ADR.md`, insira uma nova entrada logo após o fim de ADR-010 (antes de `# Considerações Finais`):

```markdown
## ADR-011 — Convite de Orador respondido por link público com token, sem autenticação

**Status:** Aceita

**Contexto**

`06.1.6 - Convites.md` (UC-CONV-005/006/007) assume que o Orador responde ao convite autenticado, via conta vinculada (RN-035/036, UC-ORA-007 "Vincular Conta ao Orador"). Essa vinculação nunca foi implementada — não há RPC, nem UI, nem portal autenticado para um Orador puro (que, por decisão de arquitetura, nunca tem `Perfil`). O mecanismo real já usado manualmente pelas congregações (WhatsApp com datas em aberto + Google Forms) não exige login.

**Decisão**

O Orador responde ao convite por um **link público com token** (`/convite/{token}`, UUID de alta entropia), sem sessão autenticada. As RPCs de resposta (`consultar_convite_publico`, `responder_convite_publico`, `enviar_confirmacao_convite_publico`) são `security definer` e concedidas ao papel `anon` — a identidade do respondente é a posse do token da URL, não uma conta.

**Alternativas consideradas**

- Construir UC-ORA-007 (Vincular Conta ao Orador) e um portal autenticado para o Orador antes desta fatia — descartada por ampliar significativamente o escopo sem necessidade: o fluxo manual que este módulo substitui (WhatsApp + Google Forms) já opera sem login, então autenticação não é um requisito real do problema, só uma suposição da especificação original.

**Consequências**

- Positivo: nenhuma dependência de UC-ORA-007; o Orador responde no mesmo nível de fricção do fluxo manual que está sendo substituído.
- Positivo: mesmo padrão `security definer` já usado no projeto, sem Edge Functions.
- Negativo: diverge de ADR-010, que optou pelo oposto (exigir sessão autenticada) para o convite de usuário da congregação (`convites_usuario`) — há inclusive uma migração (`20260818012300`) revogando acesso `anon` naquele fluxo. A distinção é deliberada: `convites_usuario` concede acesso a dados internos da congregação (exige identidade verificável), enquanto o Convite de Orador só expõe dados do próprio convite, protegidos pela posse de um token de alta entropia.
- Negativo: sem confirmação automática de identidade do Orador — mitigado pelo token UUID (não adivinhável) e pela validade de 7 dias.

---
```

- [ ] **Step 2: Atualizar a seção de Convites em `08-DER.md`**

Em `docs/08-DER.md`, substitua o bloco "## 11. Convites" inteiro (linhas 352-378 no estado atual do arquivo) por:

```markdown
## 11. Convites

Representa um convite enviado a um Orador, oferecendo datas candidatas de uma Congregação. Não depende de uma Programação pré-existente — a Programação só é criada quando o Orador aceita.

**Tabela:** `convites`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_id | UUID | FK → congregacoes |
| programacao_id | UUID | FK → programacoes, nulo até o Orador aceitar |
| orador_id | UUID | FK → oradores |
| status | VARCHAR | Estado do convite |
| token | UUID | Identifica o link público de resposta (`/convite/{token}`) |
| expira_em | TIMESTAMP | Validade do link (7 dias da criação, renovada ao reenviar) |
| enviado_em | TIMESTAMP | Data do envio |
| respondido_em | TIMESTAMP | Data da resposta |
| cancelado_em | TIMESTAMP | Data do cancelamento |
| criado_por | UUID | FK → usuarios, quem criou o convite |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Estados

- Criado
- Enviado
- Aceito
- Recusado
- Cancelado
- Expirado

---

## 11.1 Datas Candidatas do Convite

Representa uma data oferecida ao Orador dentro de um Convite. Uma data não pode ser oferecida por dois convites simultaneamente abertos (`Criado`/`Enviado`) da mesma congregação.

**Tabela:** `convite_datas`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| convite_id | UUID | FK → convites |
| data | DATE | Data candidata |
| criado_em | TIMESTAMP | Data de criação |

### Restrição

```text
UNIQUE (convite_id, data)
```

---
```

E adicione `| anexos | JSONB | Lista de arquivos anexados (\`[{ "caminho", "nome_arquivo" }]\`) |` na tabela de "## 12. Confirmações", logo após a linha `| observacoes | TEXT | Observações |`.

- [ ] **Step 3: Commit**

```bash
git add docs/13-ADR.md docs/08-DER.md
git commit -m "docs(convites): registrar ADR-011 e atualizar DER de convites/convite_datas"
```

---

### Task 12: Verificação manual (roteiro do spec)

**Files:** nenhum arquivo novo — só execução.

**Interfaces:** nenhuma.

- [ ] **Step 1: Checagem final de tipos e lint**

Rode:

```bash
cd frontend
npx tsc --noEmit
npx expo lint
```

Esperado: nenhum erro novo em nenhum arquivo tocado por este plano.

- [ ] **Step 2: Roteiro manual via `npm run web`**

Suba o app (`cd frontend && npm run web`) e, logado como Coordenador/Editor de uma congregação de teste, siga o roteiro do spec ("Plano de verificação"):

1. Criar um Convite com 3 datas candidatas para um Orador com temas preparados → convite fica "Criado", depois "Enviado"; link copiável.
2. Tentar criar um segundo convite (outro orador) reusando uma das 3 datas, mesma congregação → bloqueado pela trigger (mensagem "Uma ou mais datas já estão em outro convite aberto.").
3. Abrir o link em aba anônima/sem login → Fase 1 aparece com as 3 datas e os temas preparados do orador.
4. Escolher "Não posso nenhuma dessas datas" → convite vira "Recusado"; as datas voltam a ficar disponíveis (repetir passo 2 com sucesso agora).
5. Em um novo convite, escolher uma data + tema → Programação é criada (`status: 'Convite Enviado'`), convite vira "Aceito", Fase 2 aparece na mesma tela.
6. Clicar "Responder depois" → sair e reabrir o mesmo link → Fase 2 aparece de novo (a RPC reconsulta o estado real, não perde nada).
7. Como staff, ver o convite em `/convites/[id]` com o texto "Aceito — dados pendentes".
8. Preencher a Fase 2 (com 1 anexo) e enviar → Programação muda para "Confirmada" (trigger RN-073); convite mostra os dados da confirmação e o anexo pro staff.
9. Tentar acessar o mesmo link de novo → tela "Confirmado, obrigado!", sem formulário.
10. Criar um novo convite oferecendo o mesmo tema já usado no passo 5 (mesma congregação, Programação ainda não realizada) → tema não aparece na lista de temas disponíveis do novo orador.
11. Testar "Reenviar" num convite expirado (ajustar `expira_em` via `mcp__claude_ai_Supabase__execute_sql`) → volta a responder normalmente.
12. Testar "Cancelar" antes e depois do aceite → nos dois casos, convite fica "Cancelado"; depois do aceite, a Programação vinculada também é cancelada.
13. Como Leitor, acessar Convites → só consulta, sem "Novo Convite"/"Reenviar"/"Cancelar".

- [ ] **Step 3: Marcar como concluído**

Sem commit de código — se algum passo falhar, volte à task correspondente, corrija e re-rode `npx tsc --noEmit` antes de seguir.
