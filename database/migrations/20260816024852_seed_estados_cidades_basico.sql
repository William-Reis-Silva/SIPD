-- ============================================================================
-- SIPD — Migração: conjunto básico de estados/cidades
-- ============================================================================
--
-- Contexto:
-- O banco só tinha Minas Gerais/Timóteo (dado de bootstrap da congregação
-- "Timirim" — ver bootstrap_admin_congregacao). As sementes de cidades
-- anteriores (seed_cidades_batch1 a 6) foram perdidas quando
-- replace_prototype_with_der_schema recriou a tabela `cidades` do zero.
-- Este conjunto básico viabiliza o teste manual do seletor Estado→Cidade
-- da fatia Congregações — Dados Básicos
-- (docs/superpowers/specs/2026-08-15-congregacoes-dados-design.md).
-- ============================================================================

with novos_estados as (
  insert into public.estados (nome, uf) values
    ('São Paulo', 'SP'),
    ('Rio de Janeiro', 'RJ'),
    ('Bahia', 'BA'),
    ('Paraná', 'PR'),
    ('Espírito Santo', 'ES')
  returning id, uf
)
insert into public.cidades (estado_id, nome)
select id, nome from novos_estados, lateral (
  values
    (case uf
      when 'SP' then 'São Paulo'
      when 'RJ' then 'Rio de Janeiro'
      when 'BA' then 'Salvador'
      when 'PR' then 'Curitiba'
      when 'ES' then 'Vitória'
    end),
    (case uf
      when 'SP' then 'Campinas'
      when 'RJ' then 'Niterói'
      when 'BA' then 'Feira de Santana'
      when 'PR' then 'Londrina'
      when 'ES' then 'Vila Velha'
    end)
) as cidade(nome);
