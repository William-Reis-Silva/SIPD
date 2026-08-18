-- ============================================================================
-- SIPD — Migração: Catálogo de Temas e Categorias (UC-CAT-001 a 006)
-- ============================================================================
--
-- Contexto:
-- categorias/temas já existiam (20260812130000_replace_prototype_with_der_schema.sql)
-- com RLS mais permissiva do que este slice quer: select using(true)
-- (todo authenticated via inativos) e write for all (Administrador Global
-- podia fazer DELETE, contrariando a convenção de nunca fazer hard delete
-- usada no resto do schema). Esta migração fecha essa lacuna e adiciona a
-- constraint de unicidade de categorias.nome que faltava (DER não marcava
-- isso, mas a FA-01 de UC-CAT-005 exige a checagem de duplicidade).
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-18-catalogo-temas-categorias-design.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Constraint que faltava em categorias.nome
-- ----------------------------------------------------------------------------
alter table public.categorias
  add constraint categorias_nome_key unique (nome);

-- ----------------------------------------------------------------------------
-- 2. Revisão de RLS — categorias/temas já existiam com policies mais
-- permissivas (select using(true): todos viam inativos; write for all:
-- Administrador Global podia fazer DELETE, contrariando a convenção de
-- nunca fazer hard delete usada no resto do schema).
-- ----------------------------------------------------------------------------
drop policy categorias_select on public.categorias;
drop policy categorias_write on public.categorias;
drop policy temas_select on public.temas;
drop policy temas_write on public.temas;

create policy categorias_select on public.categorias
  for select to authenticated
  using (ativo = true or public.is_administrador_global());

create policy categorias_manage_insert on public.categorias
  for insert to authenticated
  with check (public.is_administrador_global());

create policy categorias_manage_update on public.categorias
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());

create policy temas_select on public.temas
  for select to authenticated
  using (ativo = true or public.is_administrador_global());

create policy temas_manage_insert on public.temas
  for insert to authenticated
  with check (public.is_administrador_global());

create policy temas_manage_update on public.temas
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());
