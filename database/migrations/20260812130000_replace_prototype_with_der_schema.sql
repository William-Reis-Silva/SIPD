-- ============================================================================
-- SIPD — Migração: substituição do protótipo inicial pelo schema oficial
-- ============================================================================
--
-- Contexto:
-- O projeto Supabase "Oradores" continha um protótipo inicial (7 tabelas:
-- cidades, categorias, temas, congregacoes, oradores, orador_temas,
-- programacoes) construído sobre um modelo de autorização "por dono"
-- (auth.uid() = user_id), anterior e divergente da documentação oficial
-- consolidada em docs/08-DER.md e docs/09-Dicionario-de-Dados.md.
--
-- Nenhuma das 7 tabelas do protótipo possuía dados (0 linhas em todas),
-- portanto a substituição integral é segura.
--
-- Fontes desta migração:
--   - docs/08-DER.md            (v1.2) — entidades e relacionamentos
--   - docs/09-Dicionario-de-Dados.md (v1.1) — colunas, tipos, obrigatoriedade
--   - docs/11-Permissoes.md     (v1.0) — matriz Perfil × Caso de Uso
--   - docs/13-ADR.md            — ADR-002 (RLS como segurança real),
--                                  ADR-005 (4 Perfis fixos),
--                                  ADR-007 (multi-tenancy por congregacao_id),
--                                  ADR-008 (catálogo global de Temas)
--
-- Fora de escopo desta migração (trabalho futuro):
--   - RLS granular UC-a-UC replicando 100% de docs/11-Permissoes.md
--     (aqui implementamos uma baseline defensável, não a matriz completa).
--   - Funções RPC do Motor de Regras descritas em docs/12-API.md
--     (sugerir_oradores, verificar_conflitos, cancelar_programacao,
--     confirmar_realizacao, relatorio_*, dashboard, indicadores,
--     estatisticas, vincular_conta_orador etc.) — nenhuma delas é criada
--     aqui, apenas as tabelas que elas vão operar sobre.
--   - Edge Functions (convidar-usuario, enviar-convite, importar-catalogo,
--     exportar-relatorio).
--   - Trigger de preenchimento automático de `programacoes.criado_por`
--     (o protótipo tinha um equivalente — set_created_by/set_user_id —
--     mas não foi reproduzido aqui; a aplicação deverá enviar
--     `criado_por = auth.uid()` explicitamente por enquanto).
--
-- Discrepâncias encontradas entre documentos-fonte durante esta migração
-- (não resolvidas nos documentos, apenas sinalizadas e decididas aqui
-- para viabilizar o CHECK constraint — revisar docs/02-Glossario.md,
-- docs/04-Regras-de-Negocio.md, docs/08-DER.md e docs/09-Dicionario-de-Dados.md
-- em uma futura auditoria de consistência):
--
--   1. Estados do Convite: RN-063 (04-Regras-de-Negocio.md) lista Enviado,
--      Aceito, Recusado, Cancelado, Expirado (5 estados, sem "Criado").
--      08-DER.md e 09-Dicionario-de-Dados.md listam os mesmos 5 + "Criado"
--      (6 estados). 02-Glossario.md ("Estados do Convite") descreve um
--      fluxo com "Confirmação Recebida" e "Programação Confirmada", que
--      não aparecem como valores de status do Convite em nenhum outro
--      documento — provavelmente descrevem efeitos colaterais na
--      Programação, não estados do próprio Convite. Esta migração usa a
--      lista do DER/Dicionário (a fonte estrutural direta): Criado,
--      Enviado, Aceito, Recusado, Cancelado, Expirado.
--
--   2. Estados da Programação: 02-Glossario.md ("Estados da Programação")
--      lista Planejada, Convite Enviado, Confirmada, Realizada, Arquivada
--      — sem "Cancelada". Porém RN-054 (04-Regras-de-Negocio.md) refere-se
--      explicitamente a programação "concluída ou cancelada", e
--      06.1.5 - Programações.md (UC-PRO-003) define uma transição de
--      status para "Cancelada". Esta migração usa o superset necessário
--      para não violar RN-054: Planejada, Convite Enviado, Confirmada,
--      Realizada, Cancelada, Arquivada.
--
--   3. confirmacoes.convite_id: 09-Dicionario-de-Dados.md sinaliza
--      explicitamente que a restrição UNIQUE(convite_id) "ainda precisa
--      ser formalizada". Esta migração formaliza-a como UNIQUE, pois
--      RN-070 ("Toda confirmação pertence a exatamente um convite") e a
--      cardinalidade 1:1 descrita no próprio DER só fazem sentido com essa
--      restrição física. Se essa não for a intenção, remover o UNIQUE em
--      uma migração futura.
--
-- ============================================================================


-- ============================================================================
-- 1. DROP DO PROTÓTIPO ANTERIOR
-- ============================================================================

drop table if exists public.programacoes cascade;
drop table if exists public.orador_temas cascade;
drop table if exists public.oradores cascade;
drop table if exists public.congregacoes cascade;
drop table if exists public.temas cascade;
drop table if exists public.categorias cascade;
drop table if exists public.cidades cascade;

drop function if exists public.set_created_by() cascade;
drop function if exists public.set_user_id() cascade;
drop function if exists public.congregacao_em_uso(uuid) cascade;


-- ============================================================================
-- 2. TABELAS (ordem de dependência)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 estados
-- ---------------------------------------------------------------------------
create table public.estados (
  id             uuid primary key default gen_random_uuid(),
  nome           varchar not null,
  uf             char(2) not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint estados_nome_key unique (nome),
  constraint estados_uf_key unique (uf)
);

-- ---------------------------------------------------------------------------
-- 2.2 cidades
-- ---------------------------------------------------------------------------
create table public.cidades (
  id             uuid primary key default gen_random_uuid(),
  estado_id      uuid not null references public.estados (id),
  nome           varchar not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint cidades_estado_nome_key unique (estado_id, nome)
);

create index cidades_estado_id_idx on public.cidades (estado_id);

-- ---------------------------------------------------------------------------
-- 2.3 congregacoes
-- ---------------------------------------------------------------------------
create table public.congregacoes (
  id             uuid primary key default gen_random_uuid(),
  cidade_id      uuid not null references public.cidades (id),
  nome           varchar not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index congregacoes_cidade_id_idx on public.congregacoes (cidade_id);

-- ---------------------------------------------------------------------------
-- 2.4 perfis
-- ---------------------------------------------------------------------------
create table public.perfis (
  id             uuid primary key default gen_random_uuid(),
  nome           varchar not null,
  descricao      text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint perfis_nome_key unique (nome)
);

-- Perfis iniciais (RN-010 / 04-Regras-de-Negocio.md)
insert into public.perfis (nome, descricao) values
  ('Administrador Global', 'Acesso irrestrito à plataforma. Administra congregações, usuários, perfis, permissões e a base global de temas.'),
  ('Coordenador',          'Administração completa da própria congregação: usuários, oradores, programações, convites, relatórios e configurações.'),
  ('Editor',                'Operação diária dentro da própria congregação: cadastra oradores, cria/edita programações, envia convites, consulta relatórios.'),
  ('Leitor',                'Acesso somente para consulta dentro da própria congregação.');

-- ---------------------------------------------------------------------------
-- 2.5 usuarios
-- id = auth.users.id (padrão Supabase: auth guarda credenciais, usuarios
-- guarda dados de domínio — ver 10-Arquitetura.md, "Autenticação e Sessão")
-- ---------------------------------------------------------------------------
create table public.usuarios (
  id             uuid primary key references auth.users (id) on delete cascade,
  congregacao_id uuid not null references public.congregacoes (id),
  perfil_id      uuid not null references public.perfis (id),
  nome           varchar not null,
  sobrenome      varchar not null,
  email          varchar not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index usuarios_congregacao_id_idx on public.usuarios (congregacao_id);
create index usuarios_perfil_id_idx on public.usuarios (perfil_id);

-- ---------------------------------------------------------------------------
-- 2.6 oradores (dado global — RN-034)
-- ---------------------------------------------------------------------------
create table public.oradores (
  id                     uuid primary key default gen_random_uuid(),
  congregacao_origem_id  uuid not null references public.congregacoes (id),
  cidade_id              uuid not null references public.cidades (id),
  usuario_id             uuid references public.usuarios (id), -- RN-034/035: nullable, orador pode existir sem conta
  nome                   varchar not null,
  sobrenome              varchar not null,
  telefone_normalizado   varchar not null,
  email                  varchar,
  perfil_reivindicado    boolean not null default false,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  constraint oradores_telefone_normalizado_key unique (telefone_normalizado)
);

create index oradores_congregacao_origem_id_idx on public.oradores (congregacao_origem_id);
create index oradores_cidade_id_idx on public.oradores (cidade_id);
create index oradores_usuario_id_idx on public.oradores (usuario_id);

-- ---------------------------------------------------------------------------
-- 2.7 categorias
-- ---------------------------------------------------------------------------
create table public.categorias (
  id             uuid primary key default gen_random_uuid(),
  nome           varchar not null,
  descricao      text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.8 temas (base global S-99 — RN-040/041/042/043, ADR-008)
-- ---------------------------------------------------------------------------
create table public.temas (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references public.categorias (id),
  numero         varchar not null,
  titulo         varchar not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint temas_numero_key unique (numero)
);

create index temas_categoria_id_idx on public.temas (categoria_id);

-- ---------------------------------------------------------------------------
-- 2.9 temas_preparados
-- ---------------------------------------------------------------------------
create table public.temas_preparados (
  id             uuid primary key default gen_random_uuid(),
  orador_id      uuid not null references public.oradores (id),
  tema_id        uuid not null references public.temas (id),
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint temas_preparados_orador_tema_key unique (orador_id, tema_id)
);

create index temas_preparados_orador_id_idx on public.temas_preparados (orador_id);
create index temas_preparados_tema_id_idx on public.temas_preparados (tema_id);

-- ---------------------------------------------------------------------------
-- 2.10 programacoes
-- Status: ver discrepância #2 no cabeçalho desta migração.
-- ---------------------------------------------------------------------------
create table public.programacoes (
  id              uuid primary key default gen_random_uuid(),
  congregacao_id  uuid not null references public.congregacoes (id),
  tema_id         uuid not null references public.temas (id),
  orador_id       uuid not null references public.oradores (id),
  data            date not null,
  status          varchar not null default 'Planejada'
    constraint programacoes_status_check
    check (status in ('Planejada', 'Convite Enviado', 'Confirmada', 'Realizada', 'Cancelada', 'Arquivada')),
  observacoes     text,
  criado_por      uuid not null references public.usuarios (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint programacoes_congregacao_data_key unique (congregacao_id, data)
);

create index programacoes_congregacao_id_idx on public.programacoes (congregacao_id);
create index programacoes_tema_id_idx on public.programacoes (tema_id);
create index programacoes_orador_id_idx on public.programacoes (orador_id);
create index programacoes_criado_por_idx on public.programacoes (criado_por);

-- ---------------------------------------------------------------------------
-- 2.11 convites
-- Status: ver discrepância #1 no cabeçalho desta migração.
-- ---------------------------------------------------------------------------
create table public.convites (
  id              uuid primary key default gen_random_uuid(),
  programacao_id  uuid not null references public.programacoes (id),
  orador_id       uuid not null references public.oradores (id),
  status          varchar not null default 'Criado'
    constraint convites_status_check
    check (status in ('Criado', 'Enviado', 'Aceito', 'Recusado', 'Cancelado', 'Expirado')),
  enviado_em      timestamptz,
  respondido_em   timestamptz,
  cancelado_em    timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index convites_programacao_id_idx on public.convites (programacao_id);
create index convites_orador_id_idx on public.convites (orador_id);

-- ---------------------------------------------------------------------------
-- 2.12 confirmacoes
-- UNIQUE(convite_id): ver discrepância #3 no cabeçalho desta migração.
-- ---------------------------------------------------------------------------
create table public.confirmacoes (
  id                     uuid primary key default gen_random_uuid(),
  convite_id             uuid not null references public.convites (id),
  cantico_inicial        varchar,
  utilizara_imagens      boolean,
  permanecera_ate_final  boolean,
  observacoes            text,
  enviada_em             timestamptz default now(),
  atualizada_em          timestamptz default now(),
  constraint confirmacoes_convite_id_key unique (convite_id)
);

-- ---------------------------------------------------------------------------
-- 2.13 historicos (RN-080 a RN-083 — nunca excluído)
-- ---------------------------------------------------------------------------
create table public.historicos (
  id              uuid primary key default gen_random_uuid(),
  programacao_id  uuid references public.programacoes (id),
  usuario_id      uuid references public.usuarios (id),
  tipo            varchar not null,
  descricao       text not null,
  dados           jsonb,
  criado_em       timestamptz not null default now()
);

create index historicos_programacao_id_idx on public.historicos (programacao_id);
create index historicos_usuario_id_idx on public.historicos (usuario_id);

-- ---------------------------------------------------------------------------
-- 2.14 notificacoes
-- ---------------------------------------------------------------------------
create table public.notificacoes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios (id),
  tipo         varchar not null,
  titulo       varchar not null,
  mensagem     text not null,
  lida         boolean not null default false,
  lida_em      timestamptz,
  criada_em    timestamptz not null default now()
);

create index notificacoes_usuario_id_idx on public.notificacoes (usuario_id);


-- ============================================================================
-- 3. TRIGGER GENÉRICO: atualizado_em
-- ============================================================================

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger set_atualizado_em before update on public.estados
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.cidades
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.congregacoes
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.perfis
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.usuarios
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.oradores
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.categorias
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.temas
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.temas_preparados
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.programacoes
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em before update on public.convites
  for each row execute function public.set_atualizado_em();

-- confirmacoes usa `atualizada_em` (nome distinto, ver 09-Dicionario-de-Dados.md)
create or replace function public.set_atualizada_em()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atualizada_em = now();
  return new;
end;
$$;

create trigger set_atualizada_em before update on public.confirmacoes
  for each row execute function public.set_atualizada_em();


-- ============================================================================
-- 4. FUNÇÕES AUXILIARES DE AUTORIZAÇÃO (baseline — ver seção 5)
-- ============================================================================

create or replace function public.current_usuario_congregacao_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select congregacao_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.current_usuario_perfil()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
  select p.nome
  from public.usuarios u
  join public.perfis p on p.id = u.perfil_id
  where u.id = auth.uid();
$$;

create or replace function public.is_administrador_global()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_perfil() = 'Administrador Global', false);
$$;

create or replace function public.is_coordenador_ou_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_perfil() in ('Coordenador', 'Editor'), false);
$$;

create or replace function public.is_coordenador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_usuario_perfil() = 'Coordenador', false);
$$;


-- ============================================================================
-- 5. ROW LEVEL SECURITY — BASELINE
-- ============================================================================
-- Esta seção implementa uma baseline defensável de RLS por Perfil e
-- Congregação (RN-004, RN-100, RN-101, ADR-002, ADR-007), NÃO a matriz
-- completa UC-a-UC de docs/11-Permissoes.md. Refinamento granular
-- (ex.: Editor com permissão específica concedida em UC-ADM-005) fica
-- para uma migração futura, quando o mecanismo de permissões
-- individuais for desenhado.
-- ============================================================================

alter table public.estados enable row level security;
alter table public.cidades enable row level security;
alter table public.congregacoes enable row level security;
alter table public.perfis enable row level security;
alter table public.usuarios enable row level security;
alter table public.oradores enable row level security;
alter table public.categorias enable row level security;
alter table public.temas enable row level security;
alter table public.temas_preparados enable row level security;
alter table public.programacoes enable row level security;
alter table public.convites enable row level security;
alter table public.confirmacoes enable row level security;
alter table public.historicos enable row level security;
alter table public.notificacoes enable row level security;

-- ---------------------------------------------------------------------------
-- 5.1 Dados Globais de referência (estados, cidades)
-- Sem UC dedicado em 06.1.x para gerenciar estas duas tabelas — tratadas
-- como dado de referência administrado pelo Administrador Global.
-- ---------------------------------------------------------------------------
create policy estados_select on public.estados
  for select to authenticated using (true);
create policy estados_write on public.estados
  for all to authenticated using (public.is_administrador_global()) with check (public.is_administrador_global());

create policy cidades_select on public.cidades
  for select to authenticated using (true);
create policy cidades_write on public.cidades
  for all to authenticated using (public.is_administrador_global()) with check (public.is_administrador_global());

-- ---------------------------------------------------------------------------
-- 5.2 congregacoes
-- Leitura aberta (RN-023: qualquer congregação pode convidar oradores de
-- qualquer outra). Criação/edição: Administrador Global sempre;
-- Coordenador apenas edição da própria (UC-CGR-002).
-- ---------------------------------------------------------------------------
create policy congregacoes_select on public.congregacoes
  for select to authenticated using (true);
create policy congregacoes_insert on public.congregacoes
  for insert to authenticated with check (public.is_administrador_global());
create policy congregacoes_update on public.congregacoes
  for update to authenticated
  using (public.is_administrador_global() or (public.is_coordenador() and id = public.current_usuario_congregacao_id()))
  with check (public.is_administrador_global() or (public.is_coordenador() and id = public.current_usuario_congregacao_id()));

-- ---------------------------------------------------------------------------
-- 5.3 perfis
-- Somente leitura via cliente. Perfis fixos na V1 (RN-010, UC-ADM-007 —
-- ver 12-API.md nota 1: não há endpoint de escrita para este UC na V1).
-- ---------------------------------------------------------------------------
create policy perfis_select on public.perfis
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5.4 usuarios
-- Leitura: própria congregação ou Administrador Global.
-- Autoedição: qualquer usuário edita seus próprios dados (UC-CONF-002).
-- Gestão (criar/editar outros usuários da congregação): Administrador
-- Global ou Coordenador da própria congregação (UC-ADM-005/006 — Editor
-- fica de fora por padrão, só com permissão específica futura).
-- ---------------------------------------------------------------------------
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (public.is_administrador_global() or congregacao_id = public.current_usuario_congregacao_id());

create policy usuarios_self_update on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy usuarios_manage_insert on public.usuarios
  for insert to authenticated
  with check (public.is_administrador_global() or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id()));

create policy usuarios_manage_update on public.usuarios
  for update to authenticated
  using (public.is_administrador_global() or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id()))
  with check (public.is_administrador_global() or (public.is_coordenador() and congregacao_id = public.current_usuario_congregacao_id()));

-- ---------------------------------------------------------------------------
-- 5.5 oradores, temas_preparados (dado global — RN-034)
-- Leitura aberta. Escrita: Administrador Global, Coordenador, Editor
-- (11-Permissoes.md, módulo Oradores).
-- ---------------------------------------------------------------------------
create policy oradores_select on public.oradores
  for select to authenticated using (true);
create policy oradores_write on public.oradores
  for insert to authenticated with check (public.is_administrador_global() or public.is_coordenador_ou_editor());
create policy oradores_update on public.oradores
  for update to authenticated
  using (public.is_administrador_global() or public.is_coordenador_ou_editor() or usuario_id = auth.uid())
  with check (public.is_administrador_global() or public.is_coordenador_ou_editor() or usuario_id = auth.uid());

create policy temas_preparados_select on public.temas_preparados
  for select to authenticated using (true);
create policy temas_preparados_write on public.temas_preparados
  for all to authenticated
  using (public.is_administrador_global() or public.is_coordenador_ou_editor())
  with check (public.is_administrador_global() or public.is_coordenador_ou_editor());

-- ---------------------------------------------------------------------------
-- 5.6 categorias, temas (catálogo S-99 global — ADR-008)
-- Leitura aberta. Escrita exclusiva do Administrador Global (06.1.4).
-- ---------------------------------------------------------------------------
create policy categorias_select on public.categorias
  for select to authenticated using (true);
create policy categorias_write on public.categorias
  for all to authenticated using (public.is_administrador_global()) with check (public.is_administrador_global());

create policy temas_select on public.temas
  for select to authenticated using (true);
create policy temas_write on public.temas
  for all to authenticated using (public.is_administrador_global()) with check (public.is_administrador_global());

-- ---------------------------------------------------------------------------
-- 5.7 programacoes (dado local — ADR-007)
-- Leitura: todos os 4 Perfis dentro da própria congregação, ou Admin Global.
-- Escrita (criar/editar/cancelar/confirmar): AG, Coordenador, Editor.
-- Sem policy de DELETE — cancelamento é UPDATE de status (RN-054/055).
-- ---------------------------------------------------------------------------
create policy programacoes_select on public.programacoes
  for select to authenticated
  using (public.is_administrador_global() or congregacao_id = public.current_usuario_congregacao_id());

create policy programacoes_write on public.programacoes
  for insert to authenticated
  with check (public.is_administrador_global() or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id()));

create policy programacoes_update on public.programacoes
  for update to authenticated
  using (public.is_administrador_global() or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id()))
  with check (public.is_administrador_global() or (public.is_coordenador_ou_editor() and congregacao_id = public.current_usuario_congregacao_id()));

-- ---------------------------------------------------------------------------
-- 5.8 convites
-- Leitura/gestão: equipe (AG/Coordenador/Editor) da congregação dona da
-- Programação relacionada. Resposta ao convite (aceitar/recusar): o
-- próprio Orador destinatário, via oradores.usuario_id (RN-036) — não é
-- uma ação de Perfil (11-Permissoes.md, nota 4).
-- ---------------------------------------------------------------------------
create policy convites_select on public.convites
  for select to authenticated
  using (
    public.is_administrador_global()
    or exists (
      select 1 from public.programacoes p
      where p.id = convites.programacao_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
    or exists (
      select 1 from public.oradores o
      where o.id = convites.orador_id and o.usuario_id = auth.uid()
    )
  );

create policy convites_staff_write on public.convites
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or (
      public.is_coordenador_ou_editor()
      and exists (
        select 1 from public.programacoes p
        where p.id = convites.programacao_id
          and p.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  );

create policy convites_staff_update on public.convites
  for update to authenticated
  using (
    public.is_administrador_global()
    or (
      public.is_coordenador_ou_editor()
      and exists (
        select 1 from public.programacoes p
        where p.id = convites.programacao_id
          and p.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  )
  with check (
    public.is_administrador_global()
    or (
      public.is_coordenador_ou_editor()
      and exists (
        select 1 from public.programacoes p
        where p.id = convites.programacao_id
          and p.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  );

create policy convites_orador_responde on public.convites
  for update to authenticated
  using (exists (select 1 from public.oradores o where o.id = convites.orador_id and o.usuario_id = auth.uid()))
  with check (exists (select 1 from public.oradores o where o.id = convites.orador_id and o.usuario_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 5.9 confirmacoes
-- Leitura: equipe da congregação (via convite → programação) ou o
-- próprio Orador. Criação: o próprio Orador que aceitou o convite
-- (UC-CONV-007 — RN-070/071/072).
-- ---------------------------------------------------------------------------
create policy confirmacoes_select on public.confirmacoes
  for select to authenticated
  using (
    public.is_administrador_global()
    or exists (
      select 1 from public.convites c
      join public.programacoes p on p.id = c.programacao_id
      where c.id = confirmacoes.convite_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
    or exists (
      select 1 from public.convites c
      join public.oradores o on o.id = c.orador_id
      where c.id = confirmacoes.convite_id and o.usuario_id = auth.uid()
    )
  );

create policy confirmacoes_orador_insert on public.confirmacoes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.convites c
      join public.oradores o on o.id = c.orador_id
      where c.id = confirmacoes.convite_id and o.usuario_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5.10 historicos (RN-082: nunca excluído — sem policy de UPDATE/DELETE)
-- ---------------------------------------------------------------------------
create policy historicos_select on public.historicos
  for select to authenticated
  using (
    public.is_administrador_global()
    or exists (
      select 1 from public.programacoes p
      where p.id = historicos.programacao_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
  );

create policy historicos_insert on public.historicos
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or (
      programacao_id is null
      or exists (
        select 1 from public.programacoes p
        where p.id = historicos.programacao_id
          and p.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5.11 notificacoes
-- Cada usuário vê/marca como lida apenas suas próprias notificações.
-- Coordenador/AG também podem visualizar as da própria congregação
-- (acompanhamento de pendências no Dashboard). Sem policy de DELETE.
-- ---------------------------------------------------------------------------
create policy notificacoes_self_select on public.notificacoes
  for select to authenticated using (usuario_id = auth.uid());

create policy notificacoes_staff_select on public.notificacoes
  for select to authenticated
  using (
    public.is_administrador_global()
    or (
      public.is_coordenador()
      and exists (
        select 1 from public.usuarios u
        where u.id = notificacoes.usuario_id and u.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  );

create policy notificacoes_self_update on public.notificacoes
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy notificacoes_insert on public.notificacoes
  for insert to authenticated
  with check (
    public.is_administrador_global()
    or (
      public.is_coordenador_ou_editor()
      and exists (
        select 1 from public.usuarios u
        where u.id = notificacoes.usuario_id and u.congregacao_id = public.current_usuario_congregacao_id()
      )
    )
  );

-- ============================================================================
-- Fim da migração
-- ============================================================================
