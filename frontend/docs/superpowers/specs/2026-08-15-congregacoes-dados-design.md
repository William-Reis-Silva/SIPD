# Congregações — Dados Básicos (Consultar, Atualizar)

**Data:** 2026-08-15
**Módulo:** Congregações (`docs/06.1.2 - Congregações.md`)
**Casos de Uso cobertos:** UC-CGR-001 (Consultar Congregação), UC-CGR-002 (Atualizar Dados da Congregação)
**Fora de escopo (próxima fatia):** UC-CGR-003 (Gerenciar Usuários da Congregação — convite, atribuição de perfil, ativação/desativação de usuários)

---

## Atualização (2026-08-16, pós-implementação)

O seletor de Cidade descrito abaixo (Modal + lista nativa, "sem nova dependência de UI") foi substituído, a pedido do usuário após o teste manual: em vez de só escolher entre cidades já cadastradas, o campo de Cidade agora é um combobox com busca (`react-native-element-dropdown`, única exceção à regra de "sem dependência nova") que também permite cadastrar uma cidade nova quando ela não existe — reduzindo o risco de digitação inconsistente do nome. O Estado usa o mesmo componente, sem a opção de criar (lista fixa de 27, cadastro de referência do Administrador Global).

Cadastrar uma cidade nova passa a ser permitido para Coordenador e Administrador Global (antes só Admin Global, via `cidades_write`), através de uma função RPC dedicada — `encontrar_ou_criar_cidade(estado_id, nome)`, `security definer`, que normaliza o nome (trim + case-insensitive) antes de decidir se vincula a uma cidade existente ou cria uma nova. A política de escrita direta em `cidades` (`cidades_write`) não mudou — continua restrita ao Administrador Global; a RPC é o único caminho adicional, controlado, para os demais perfis editores de Congregação.

Também foi necessário popular um conjunto básico de estados/cidades (`20260816024852_seed_estados_cidades_basico.sql`) — o banco só tinha Minas Gerais/Timóteo (bootstrap), insuficiente para testar a troca de Estado.

---

## Contexto

O módulo de Administração (autenticação) está concluído — todo usuário autenticado já carrega `usuario.congregacao_id` e `usuario.perfil.nome` via `useAuth()`. Esta fatia entrega a segunda dependência de base do roadmap (`14-Roadmap.md`): consultar e editar os dados da própria congregação.

A tabela `congregacoes` já existe no Supabase (`imeoyetcbjlkrxubwldv`) com RLS habilitado e 1 registro real (congregação "Timirim"), mas com um schema mais enxuto do que o necessário: só `id`, `cidade_id`, `nome`, `ativo`, timestamps — sem campo para o número oficial de registro da congregação, que a UC-CGR-002 precisa cobrir (usuário pode ter digitado errado no cadastro original e precisa corrigir).

As RLS Policies `congregacoes_select` (leitura aberta a qualquer autenticado) e `congregacoes_update` (Administrador Global sempre; Coordenador restrito à própria congregação, via `current_usuario_congregacao_id()`) já existem na migração `20260812130000_replace_prototype_with_der_schema.sql` e já implementam exatamente a autorização exigida por UC-CGR-001/002 — nenhuma mudança de RLS é necessária nesta fatia.

## Não-objetivos

- Gestão de usuários da congregação (UC-CGR-003): convite, atribuição de perfil, ativação/desativação. Fica para uma fatia futura.
- Listagem de todas as congregações da plataforma para o Administrador Global (FA-01 de UC-CGR-001). Nesta fatia, todo Perfil — incluindo Administrador Global — vê apenas a própria congregação vinculada.
- Campo `ativo` (ativar/desativar a própria congregação) como editável.
- Testes automatizados: o projeto não tem framework de testes configurado ainda; verificação manual (ver "Plano de verificação").

## Arquitetura

### Modelo de Dados

A tabela `congregacoes` ganha uma coluna nova, `numero` — o número oficial de registro da congregação, atribuído externamente pela organização, único entre as congregações e obrigatório:

```sql
alter table public.congregacoes add column numero varchar;
update public.congregacoes set numero = '48991' where nome = 'Timirim';
alter table public.congregacoes alter column numero set not null;
alter table public.congregacoes add constraint congregacoes_numero_key unique (numero);
```

O valor `'48991'` é o número real da congregação já cadastrada (confirmado pelo usuário), usado como backfill antes de tornar a coluna `NOT NULL`.

**Nova Regra de Negócio — RN-025** (grupo "Congregações" em `04-Regras-de-Negocio.md`, após RN-024):

> Toda congregação deverá possuir um número oficial, único entre as congregações.

`08-DER.md` (seção "3. Congregações") e `09-Dicionario-de-Dados.md` são atualizados para incluir a coluna `numero` (`VARCHAR`, obrigatório, único).

### Auditoria (RN-102)

RN-102 exige que toda operação crítica seja registrada em `historicos`. Não existe hoje nenhum trigger de auditoria no banco — só o trigger genérico `set_atualizado_em`. Seguindo o padrão já estabelecido para efeitos colaterais de banco em Convites (RN-070/071/073, ver `12-API.md` nota 8: "implementados via trigger PostgreSQL, não Edge Function — não exigem privilégio elevado nem serviço externo"), esta fatia adiciona um trigger `AFTER UPDATE` dedicado:

```sql
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
```

O `WHEN` evita disparar o registro quando nenhum dos três campos editáveis mudou (ex.: um `UPDATE` futuro que só toque `ativo`). A função é `security definer`, seguindo o mesmo estilo das funções auxiliares de autorização já existentes (`current_usuario_congregacao_id()`, `is_administrador_global()`, etc.) — grava em `historicos` independentemente de RLS, e `auth.uid()` continua resolvendo o usuário autenticado normalmente dentro de uma função `security definer` (lê do JWT da sessão, não do dono da função).

A policy `historicos_insert` já aceita `programacao_id is null` incondicionalmente, então nenhuma mudança de RLS é necessária ali.

### Frontend

**Módulo novo:** `src/features/congregacoes/`
- `use-congregacao.ts` — hook que busca a congregação vinculada (`usuario.congregacao_id`, de `useAuth()`) via `supabase.from('congregacoes').select('id, numero, nome, cidade_id, cidade:cidades(id, nome, estado_id)').eq('id', usuario.congregacao_id).single()`, expõe `{ status: 'loading' | 'ready' | 'error', congregacao, atualizar(dados) }`. Sem Context — só a tela nova consome isso por enquanto (diferente do módulo de auth, que precisa do estado em toda a árvore de rotas).

**Roteamento:** nova tab "Congregação" em `src/components/app-tabs.tsx` e `app-tabs.web.tsx`, ao lado de "Home" — consistente com o crescimento futuro do app (Oradores, Programações etc. também vão virar tabs).

**Tela nova:** `src/app/(app)/congregacao.tsx`
- Modo leitura (padrão): nome, número e cidade (nome da cidade + UF) exibidos como texto.
- Se `usuario.perfil.nome` for `'Coordenador'` ou `'Administrador Global'`, exibe botão "Editar" (checagem de UI apenas — a autorização real é a RLS `congregacoes_update`, conforme convenção do projeto em `12-API.md`: "a interface apenas evita apresentar ações não permitidas").
- Modo edição: campos de texto para nome e número; seleção de cidade em duas etapas (Estado → Cidade, populando o segundo seletor a partir do primeiro), implementada com `Modal` + lista nativa do React Native — sem adicionar nova dependência de UI. Botões "Salvar" e "Cancelar".
- Estado de carregamento no botão "Salvar" (evita duplo submit), mesmo padrão de `login.tsx`.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Número já em uso por outra congregação | Violação da constraint `congregacoes_numero_key` | "Esse número já está em uso por outra congregação." |
| Nome ou número em branco | Validação client-side, antes do `PATCH` | "Informe o nome e o número da congregação." |
| Falha ao salvar (rede ou outro erro do servidor) | Exceção/erro do `PATCH` | "Não foi possível salvar as alterações. Tente novamente." |

## Plano de verificação (manual)

Sem framework de testes configurado, verificação via `npm run web`:

1. Logar com um usuário Leitor ou Editor → acessar a tab Congregação → ver nome/número/cidade, sem botão "Editar".
2. Logar como Coordenador (ou Administrador Global) → "Editar" → alterar nome, número e cidade → "Salvar" → confirmar que os dados exibidos refletem a mudança.
3. Consultar `historicos` (via SQL) após o passo 2 e confirmar que existe uma linha `tipo = 'congregacao_atualizada'` com `dados.antes`/`dados.depois` corretos.
4. Tentar salvar um número que já pertence a outra congregação (exige uma segunda congregação de teste, ou simular a violação) → confirmar a mensagem de erro amigável e que nada foi alterado.
5. Deixar nome ou número em branco e tentar salvar → confirmar a validação client-side, sem chamada ao servidor.

## Arquivos afetados

**Novos:**
- `database/migrations/20260815120000_add_numero_to_congregacoes.sql`
- `src/features/congregacoes/use-congregacao.ts`
- `src/app/(app)/congregacao.tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova tab.
- `docs/04-Regras-de-Negocio.md` — nova RN-025.
- `docs/08-DER.md`, `docs/09-Dicionario-de-Dados.md` — coluna `numero` em `congregacoes`.
