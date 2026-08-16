-- ============================================================================
-- SIPD — Migração: RPC encontrar_ou_criar_cidade
-- ============================================================================
--
-- Contexto:
-- A edição de Congregação (UC-CGR-002) ganhou um seletor de Cidade com
-- busca (react-native-element-dropdown) que também permite cadastrar uma
-- cidade nova quando ela não existe ainda. Cidades são cadastro de
-- referência global — a RLS de escrita direta em `cidades` (`cidades_write`)
-- permanece restrita ao Administrador Global. Esta função é o único
-- caminho adicional, controlado, para Coordenador também poder cadastrar
-- uma cidade nesse fluxo específico, seguindo o padrão de "validação
-- composta" já registrado em docs/12-API.md (RPC em vez de tabela direta):
-- vincula a uma cidade já existente do Estado (comparação normalizada,
-- trim + case-insensitive) ou cria uma nova, em uma única chamada atômica,
-- com fallback a um SELECT em caso de corrida (unique_violation).
-- ============================================================================

create or replace function public.encontrar_ou_criar_cidade(p_estado_id uuid, p_nome varchar)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.is_administrador_global() or public.is_coordenador()) then
    raise exception 'Sem permissão para cadastrar cidade.' using errcode = '42501';
  end if;

  select id into v_id
  from public.cidades
  where estado_id = p_estado_id
    and lower(trim(nome)) = lower(trim(p_nome))
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  begin
    insert into public.cidades (estado_id, nome)
    values (p_estado_id, trim(p_nome))
    returning id into v_id;
  exception when unique_violation then
    select id into v_id
    from public.cidades
    where estado_id = p_estado_id and nome = trim(p_nome);
  end;

  return v_id;
end;
$$;

grant execute on function public.encontrar_ou_criar_cidade(uuid, varchar) to authenticated;
