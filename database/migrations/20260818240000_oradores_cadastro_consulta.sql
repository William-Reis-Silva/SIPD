-- ============================================================================
-- SIPD — Migração: Oradores (UC-ORA-001 a 006)
-- ============================================================================
--
-- Contexto:
-- oradores/temas_preparados já existiam com RLS já correta (sem mudança
-- aqui). Esta migração adiciona:
-- 1. Trigger que trava congregacao_origem_id para Coordenador/Editor quando
--    o orador já tem conta vinculada (UC-ORA-002 FA-02) — só o próprio
--    orador ou o Administrador Global podem mudar nesse caso.
-- 2. Correção de historicos_select: a policy original não liberava leitura
--    de linhas com programacao_id NULL para não-Administrador-Global,
--    contrariando a permissão já dada por historicos_insert e bloqueando
--    silenciosamente o histórico de Catálogo/Usuários já em produção, além
--    do novo histórico de Oradores desta fatia.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-18-oradores-cadastro-consulta-design.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trigger: trava condicional de congregacao_origem_id (UC-ORA-002 FA-02)
-- Coordenador/Editor podem editar normalmente enquanto o orador não tiver
-- conta vinculada. A partir do momento em que usuario_id é preenchido, só
-- o próprio orador ou o Administrador Global podem mudar a origem.
-- ----------------------------------------------------------------------------
create or replace function public.travar_origem_orador_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.congregacao_origem_id is distinct from old.congregacao_origem_id then
    if old.usuario_id is not null
       and old.usuario_id <> auth.uid()
       and not public.is_administrador_global() then
      raise exception 'origem_travada_orador_vinculado';
    end if;
  end if;
  return new;
end;
$$;

create trigger travar_origem_orador_vinculado
  before update on public.oradores
  for each row execute function public.travar_origem_orador_vinculado();

-- ----------------------------------------------------------------------------
-- 2. Revisão de historicos_select — a policy original só liberava leitura
-- de linhas com programacao_id resolvendo para a congregação do usuário (ou
-- Administrador Global). Linhas com programacao_id NULL (todo o histórico já
-- existente de Catálogo/Usuários, e o novo histórico de Oradores desta fatia)
-- ficavam invisíveis para quem não é Administrador Global — a policy de
-- INSERT já permitia programacao_id NULL para todo authenticated, então essa
-- leitura já deveria ter sido liberada do mesmo jeito.
-- ----------------------------------------------------------------------------
drop policy historicos_select on public.historicos;

create policy historicos_select on public.historicos
  for select to authenticated
  using (
    public.is_administrador_global()
    or programacao_id is null
    or exists (
      select 1 from public.programacoes p
      where p.id = historicos.programacao_id
        and p.congregacao_id = public.current_usuario_congregacao_id()
    )
  );
