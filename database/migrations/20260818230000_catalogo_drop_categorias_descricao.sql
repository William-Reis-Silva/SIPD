-- ============================================================================
-- SIPD — Catálogo: remover coluna categorias.descricao
-- ============================================================================
--
-- Contexto:
-- Decisão do usuário durante a verificação manual do slice de Catálogo de
-- Temas e Categorias (UC-CAT-001 a 006): o campo "descrição" de Categoria
-- não será usado. Removida a coluna do banco e o campo correspondente do
-- frontend (use-categorias.ts, catalogo.tsx) e da documentação.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-18-catalogo-temas-categorias-design.md
-- ============================================================================

alter table public.categorias drop column descricao;
