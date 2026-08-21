-- ============================================================================
-- SIPD — Migração: Suporte (FAQ + Chamados)
-- ============================================================================
--
-- Contexto:
-- Suporte não faz parte dos UCs originais (docs/06.1.*) — escopo novo pedido
-- diretamente pelo usuário durante teste manual. Chamado é 1 pergunta + 1
-- resposta (sem thread); FAQ fica fixo no código do frontend, sem tabela
-- própria. RLS reaproveita public.is_administrador_global(), já existente.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-20-suporte-design.md
-- ============================================================================

create table public.suporte_mensagens (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios(id),
  assunto        varchar(200) not null,
  mensagem       text not null,
  status         varchar not null default 'Aberto'
                   check (status in ('Aberto', 'Respondido')),
  resposta       text,
  respondido_por uuid references public.usuarios(id),
  respondido_em  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create trigger set_atualizado_em before update on public.suporte_mensagens
  for each row execute function public.set_atualizado_em();

alter table public.suporte_mensagens enable row level security;

create policy suporte_mensagens_select on public.suporte_mensagens
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_administrador_global());

create policy suporte_mensagens_insert on public.suporte_mensagens
  for insert to authenticated
  with check (usuario_id = auth.uid());

create policy suporte_mensagens_update on public.suporte_mensagens
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());
