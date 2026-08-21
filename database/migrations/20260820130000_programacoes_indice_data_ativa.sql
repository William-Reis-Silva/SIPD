-- ============================================================================
-- SIPD — Migração: Programações — índice único condicional (RN-051)
-- ============================================================================
--
-- Contexto:
-- programacoes já existe (20260812130000_replace_prototype_with_der_schema.sql)
-- com UNIQUE (congregacao_id, data) sem exceção para status Cancelada. RN-051
-- fala em programação ATIVA — cancelar e remarcar na mesma data hoje falha
-- por violação de unicidade. Corrige para um índice único parcial.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-20-programacoes-agenda-calendario-design.md
-- ============================================================================

alter table public.programacoes drop constraint programacoes_congregacao_data_key;

create unique index programacoes_congregacao_data_ativa_key
  on public.programacoes (congregacao_id, data)
  where status <> 'Cancelada';
