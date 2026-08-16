-- ============================================================================
-- SIPD — Migração: número oficial da congregação + auditoria (RN-025, RN-102)
-- ============================================================================
--
-- Contexto:
-- UC-CGR-002 (docs/06.1.2 - Congregações.md) exige que o usuário possa
-- corrigir o número oficial da congregação, mas a tabela congregacoes não
-- tinha essa coluna (docs/08-DER.md v1.2). Esta migração adiciona `numero`
-- (obrigatório, único) e um trigger de auditoria para RN-102, que ainda não
-- tinha nenhuma implementação além do trigger genérico de atualizado_em.
--
-- Fontes: docs/superpowers/specs/2026-08-15-congregacoes-dados-design.md
-- ============================================================================

-- Coluna numero: número oficial de registro da congregação (RN-025).
alter table public.congregacoes add column numero varchar;

-- Backfill do único registro existente (congregação "Timirim").
update public.congregacoes set numero = '48991' where nome = 'Timirim';

alter table public.congregacoes alter column numero set not null;
alter table public.congregacoes add constraint congregacoes_numero_key unique (numero);

-- Auditoria (RN-102): registra em historicos quando nome, numero ou
-- cidade_id mudam. security definer, mesmo estilo das funções auxiliares
-- já existentes (current_usuario_congregacao_id, is_administrador_global).
create function public.log_congregacao_atualizada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.historicos (usuario_id, tipo, descricao, dados)
  values (
    auth.uid(), 'congregacao_atualizada', 'Dados da congregação atualizados',
    jsonb_build_object(
      'congregacao_id', new.id,
      'antes', jsonb_build_object('nome', old.nome, 'numero', old.numero, 'cidade_id', old.cidade_id),
      'depois', jsonb_build_object('nome', new.nome, 'numero', new.numero, 'cidade_id', new.cidade_id)
    )
  );
  return new;
end;
$$;

create trigger log_congregacao_atualizada after update on public.congregacoes
  for each row
  when (old.nome is distinct from new.nome or old.numero is distinct from new.numero or old.cidade_id is distinct from new.cidade_id)
  execute function public.log_congregacao_atualizada();
