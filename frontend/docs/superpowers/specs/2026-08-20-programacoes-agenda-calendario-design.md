# Programações — Agenda, Calendário, Criar/Editar/Cancelar/Confirmar (UC-PRO-001 a 006)

**Data:** 2026-08-20
**Módulo:** Programações (`06.1.5 - Programações.md`)
**Fora de escopo (fatias futuras):** Convites (`06.1.6`), Motor de Regras/alertas soft (`06.1.9`) — ver "Não-objetivos".

---

## Contexto

`14-Roadmap.md` coloca Programações como a 5ª fatia (depois de Administração, Congregações, Catálogo, Oradores — todas já construídas). O módulo cobre 6 Casos de Uso: criar, editar, cancelar, consultar (Agenda + Calendário) e confirmar realização de uma Programação.

**Achado 1 — numeração de RN trocada em `06.1.5`:** os UCs desse documento referenciam RN-040 a RN-044 nas suas seções "Regras de Negócio Relacionadas", mas essas são as regras de **Temas** em `04-Regras-de-Negocio.md` (base global, número único, título oficial, categoria, tema preparado). As regras reais de Programações são **RN-050 a RN-055**:

- RN-050: toda programação deve ter congregação, data, tema, orador, status.
- RN-051: não pode existir mais de uma programação **ativa** pra mesma congregação na mesma data.
- RN-052: cada programação tem apenas um orador principal.
- RN-053: toda programação deve ter um status.
- RN-054: uma programação pode ser alterada enquanto não estiver concluída (`Realizada`) ou cancelada.
- RN-055: após realizada, a programação é arquivada para fins históricos.

O conteúdo de cada UC (fluxos, exceções, pós-condições) já bate exatamente com RN-050/051/054/055 — só a referência cruzada está errada. Esta spec usa o conteúdo correto; a correção da numeração em `06.1.5` fica registrada aqui, sem exigir edição do documento formal (fora do escopo desta fatia mexer nos documentos de especificação em si).

**Achado 2 — bug de fato no banco:** `programacoes` já existe (criada em `20260812130000_replace_prototype_with_der_schema.sql`) com `UNIQUE (congregacao_id, data)` **sem** exceção para status `Cancelada`. Isso contraria RN-051 (que fala em programação **ativa**): hoje, cancelar uma programação e tentar criar outra pra mesma congregação na mesma data falharia por violação de unicidade. Corrigido nesta fatia (ver "Modelo de Dados").

**RLS já correta:** diferente da constraint acima, a RLS de `programacoes`/`convites`/`confirmacoes` já existe e já bate exatamente com `11-Permissoes.md` (Administrador Global e "coordenador ou editor" da própria congregação podem criar/editar; todos os autenticados da congregação leem; Leitor só lê). Usa duas funções já existentes: `is_administrador_global()` e `is_coordenador_ou_editor()`. Nenhuma mudança de RLS nesta fatia.

## Não-objetivos

- **Convites** (`06.1.6`, UC-CONV) — próxima fatia do roadmap. Os status `Convite Enviado` e `Confirmada` do enum de `programacoes.status` existem no banco mas ficam inalcançáveis por enquanto; esta fatia só produz as transições `Planejada` → `Cancelada` ou `Planejada` → `Realizada`.
- **Conteúdo da Confirmação** (RN-070 a 073 — cântico inicial, uso de imagens, arquivos, permanência até o final) — preenchido pelo Orador ao responder um Convite (RN-062); pertence à fatia de Convites, não a esta. A tabela `confirmacoes` não é tocada aqui.
- **Alertas e conflitos "soft"** (RN-090 "tema usado recentemente", RN-091 "tema já programado no futuro", RN-093 "identificar conflitos antes de salvar") — é o Motor de Regras do módulo Inteligência (`06.1.9`), o último do roadmap, que ainda não existe. Só a regra **dura** (RN-051, unicidade de data ativa por congregação) é aplicada agora, via constraint de banco — as FA-03/FE-03 de UC-PRO-001 ("existem alertas"/"conflito de programação") ficam sem efeito nesta fatia; o formulário só bloqueia no caso duro (data duplicada).
- **Status `Arquivada`** — nenhum UC deste documento produz essa transição (UC-PRO-006 só leva a `Realizada`; RN-055 descreve o *efeito* de ficar arquivada para fins históricos, não uma ação de UI separada). Fica sem uso nesta fatia; se um processo de arquivamento automático for necessário, é decisão do Motor de Regras (`06.1.9`).
- **FA-01/FA-02 de UC-PRO-002** ("ao alterar orador/tema, avaliar convites e confirmações existentes") — não há Convites nesta fatia (ver acima), então não há nada a avaliar ainda; editar orador/tema/data fica livre enquanto RN-054 permitir. Vale revisitar quando Convites existir.
- Testes automatizados — projeto ainda sem framework configurado; verificação manual (mesmo padrão das fatias anteriores).

## Arquitetura

### Modelo de Dados

`programacoes` já existe com as colunas certas (`08-DER.md` §10) e RLS já correta (ver "Contexto"). Uma correção nesta fatia:

**Índice único condicional** (RN-051 — "ativa"):

```sql
drop index public.programacoes_congregacao_data_key;

create unique index programacoes_congregacao_data_ativa_key
  on public.programacoes (congregacao_id, data)
  where status <> 'Cancelada';
```

Isso permite remarcar na mesma data depois de cancelar, sem abrir mão da regra dura de "uma programação ativa por dia por congregação".

Nenhuma mudança em `convites`/`confirmacoes` (fora de escopo, ver "Não-objetivos") nem em RLS (já correta).

### Convenção de Histórico

Diferente de Oradores/Temas (que não têm coluna própria em `historicos` e usam `dados->>'x_id'`), `historicos` **já tem** a coluna `programacao_id` (`08-DER.md`, tabela `historicos`) — usada diretamente aqui:

- Criar (UC-PRO-001, lista RN-082/083) → `tipo: 'programacao_criada'`
- Editar (UC-PRO-002, lista RN-083/102) → `tipo: 'programacao_editada'`
- Cancelar (UC-PRO-003, lista RN-102) → `tipo: 'programacao_cancelada'`
- Confirmar Realização (UC-PRO-006, não lista RN-102 explicitamente, mas é claramente uma "operação crítica" por RN-102 e o próprio UC pede registro no Histórico) → `tipo: 'programacao_realizada'`

Todos com `programacao_id: <id>`, `usuario_id: null`, `descricao` textual curta. `usuario_id` em `historicos` não guarda "quem executou a ação" em nenhum hook já existente (Oradores/Temas/Categorias também gravam `null` ali) — é usado só quando o evento é *sobre* um usuário específico (ex.: `usuario_perfil_alterado` em `use-usuarios-congregacao.ts`, onde `usuario_id` é o usuário afetado, não quem alterou). Programação não tem um "usuário-assunto" — segue o mesmo `null` do restante do catálogo/oradores.

### Frontend

**Nova aba "Programações"** em `app-tabs.tsx`/`app-tabs.web.tsx`, visível a todos os perfis (consulta é liberada a todos — UC-PRO-004/005).

**Estrutura de rotas** (pasta, mesmo raciocínio de Oradores — volume de dados por item justifica tela de detalhe própria):

```
src/app/(app)/programacoes/
  index.tsx   — Agenda + Calendário (alterna via abas, rota alvo da aba de navegação)
  [id].tsx    — detalhe (ver/editar/cancelar/confirmar realização)
  nova.tsx    — criar
```

**Componente novo reutilizável — `src/components/calendario-mensal.tsx`:**

```ts
export type CalendarioMensalProps = {
  ano: number;
  mes: number; // 0-11
  diasComEvento?: Set<string>; // 'YYYY-MM-DD', desenha uma marcação no dia
  diaSelecionado?: string | null; // 'YYYY-MM-DD'
  onSelecionarDia: (dataIso: string) => void;
  onMudarMes: (ano: number, mes: number) => void;
};
```

Grade de mês pura (View/Pressable/Text — sem lib nova), com setas "‹"/"›" pra navegar entre meses. Dois usos:
1. **Aba Calendário** (`programacoes/index.tsx`): o pai é dono de `ano`/`mes`, computa `diasComEvento` a partir da lista já carregada; ao tocar num dia, mostra abaixo da grade a lista de programações daquele dia (pensado pro caso do Administrador Global, que pode ver mais de uma congregação — para um usuário comum é sempre 0 ou 1, por causa de RN-051).
2. **Seletor de data** (`programacoes/nova.tsx` e edição em `[id].tsx`): sem `diasComEvento`; um `Pressable` mostra a data escolhida (ou "Selecionar data") e alterna a grade visível/oculta abaixo dele (mesmo padrão de seção que abre/fecha já usado no FAQ do Suporte — sem Modal, que não é usado em nenhum lugar do app hoje).

**`programacoes/index.tsx`:**
- Abas "Lista" / "Calendário" (mesmo padrão de `temas.tsx` Temas/Categorias).
- **Administrador Global apenas**: dropdown "Filtrar por congregação" (busca sobre `congregacoes`, mesmo padrão inline-fetch já usado em `oradores/novo.tsx`) — filtra a lista já carregada no client; sem filtro, mostra todas (a RLS já devolve todas as congregações pra AG). Para os demais perfis, a RLS já limita à própria congregação — sem filtro visível.
- **Lista**: cada item mostra data (formatada `dd/mm/aaaa`), tema (número + título), orador, status; toque navega para `/programacoes/[id]`.
- **Calendário**: usa `CalendarioMensal` (modo 1 acima).
- Botão "Nova Programação" (topo), visível só para Administrador Global, Coordenador, Editor — mesmo `podeGerenciar` já usado em Oradores.

**`programacoes/nova.tsx`** — formulário:
- Data: `CalendarioMensal` compacto (modo 2).
- Congregação: só aparece (dropdown, busca em `congregacoes`) se Administrador Global — RLS de `programacoes_write` permite AG escrever com qualquer `congregacao_id` (não exige `= current_usuario_congregacao_id()`, diferente de Coordenador/Editor). Para Coordenador/Editor, a congregação é a própria (`usuario.congregacao_id`), fixa, sem campo editável.
- Tema: `Dropdown` de busca (reaproveitando `DropdownSearchInput`, mesmo padrão de Enter-para-selecionar já usado em Oradores) sobre `useTemas()`; ao escolher, mostra número/título/categoria do tema selecionado logo abaixo (UC-PRO-001 fluxo principal passo 4).
- Orador: `Dropdown` de busca (mesmo padrão) sobre todos os oradores ativos, **ordenados priorizando quem já tem o tema selecionado como preparado** (FA-01/RN-092) — mesma lógica de ordenação por relevância já usada em `oradores/index.tsx` (`ordenarTemasPorRelevancia`), adaptada: em vez de ordenar temas por texto de busca, ordena oradores por "tem o tema_id selecionado em `temas_preparados`". Sem tema selecionado ainda, lista todos os oradores em ordem alfabética, sem prioridade (nada pra priorizar).
- Observações (opcional).
- Confirma → `INSERT` com `status: 'Planejada'` + log `programacao_criada`. Erro de unicidade (`23505` no índice novo) → mensagem amigável (ver "Tratamento de erros").

**`programacoes/[id].tsx`** — três blocos na mesma tela:
- **Dados**: data, congregação (só leitura), tema, orador, observações, status. `podeGerenciar` (Editor/Coordenador da própria congregação, ou Administrador Global) e `status not in ('Realizada', 'Cancelada')` (RN-054) veem "Editar" → mesmo padrão inline de `oradores/[id].tsx` (troca pra formulário, com o mesmo seletor de data/tema/orador de `nova.tsx`). Confirma → `UPDATE` + log `programacao_editada`.
- **Ações**: "Cancelar Programação" (visível se `podeGerenciar` e `status not in ('Realizada', 'Cancelada')` — RN mapeada em FE-01 de UC-PRO-003; executa direto no toque, sem diálogo de confirmação — não existe nenhum padrão de confirmação em nenhuma tela do app hoje, ex. "Remover" tema preparado em Oradores também executa direto) → `UPDATE status = 'Cancelada'` + log `programacao_cancelada`. "Confirmar Realização" (visível se `podeGerenciar`, `status not in ('Realizada', 'Cancelada')` e `data <= hoje` — pré-condição do UC; a checagem é "não concluída/cancelada" em vez de "só a partir de `Planejada`" para continuar correta quando os status intermediários de Convites existirem) → `UPDATE status = 'Realizada'` + log `programacao_realizada`.
- **Histórico**: eventos de `historicos` filtrados por `programacao_id = :id` (consulta direta pela coluna própria, sem o workaround de `dados->>'x_id'` usado em Oradores/Temas), mais recente primeiro.

**Hook novo:** `src/features/programacoes/use-programacoes.ts`
- `programacoes` — `select` com embeds (`congregacao:congregacoes(...)`, `tema:temas(...)`, `orador:oradores(...)`), ordenado por `data`; a RLS decide o que volta.
- `criarProgramacao(dados)`, `editarProgramacao(programacao, dados)`, `cancelarProgramacao(programacao)`, `confirmarRealizacao(programacao)`.
- `useHistoricoProgramacao(programacaoId)` — hook separado, mesmo padrão de `use-historico-orador.ts`, mas consultando `programacao_id` direto em vez de `dados->>'orador_id'`.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Já existe programação ativa nessa data pra congregação | `unique_violation` no índice `programacoes_congregacao_data_ativa_key` | "Já existe uma programação para esta congregação nesta data." |
| Campos obrigatórios ausentes (data, tema, orador) | Validação client-side | "Preencha data, tema e orador." |
| Cancelar programação já realizada | Botão escondido (`status <> 'Realizada'`); defesa extra se chamado mesmo assim | "Esta programação já foi realizada e não pode ser cancelada." |
| Confirmar realização antes da data ou já confirmada/cancelada | Botão escondido pela condição client-side; defesa extra | "Não é possível confirmar a realização ainda." |
| Editar programação `Realizada`/`Cancelada` | Botão "Editar" escondido (RN-054) | — (sem round-trip; UI não oferece a ação) |
| Falha genérica ao salvar (rede, RLS) | Exceção não classificada | "Não foi possível salvar. Tente novamente." |
| Falha ao carregar lista/detalhe | Exceção não classificada | "Não foi possível carregar as programações." |

## Plano de verificação (manual)

Via `npm run web`, logado com a conta de teste já usada nesta conversa (Administrador Global) e, quando necessário simular Coordenador/Editor/Leitor, trocando o perfil do usuário de teste via SQL (`update usuarios set perfil_id = ...`):

1. Como Coordenador/Editor, criar uma Programação (data via calendário compacto, tema, orador) → aparece na Agenda (lista) e no Calendário, evento `programacao_criada` no Histórico dela.
2. Tentar criar outra Programação pra mesma congregação na mesma data → mensagem de duplicidade, criação bloqueada.
3. Cancelar a Programação do passo 1 → status muda pra `Cancelada`, evento `programacao_cancelada` no Histórico.
4. Criar uma nova Programação pra mesma congregação **na mesma data** da cancelada → agora permitido (confirma a correção do índice).
5. Escolher um tema que tenha oradores preparados → confirmar que esses oradores aparecem primeiro no dropdown de orador.
6. Editar a Programação (trocar tema/orador/data) → confirma atualização e evento `programacao_editada`.
7. Simular uma Programação com `data` no passado (via SQL) e confirmar a realização pela UI → status muda pra `Realizada`, evento `programacao_realizada`; botão "Confirmar Realização" some depois.
8. Tentar cancelar uma Programação já `Realizada` → botão não aparece.
9. Tentar editar uma Programação `Realizada` ou `Cancelada` → botão "Editar" não aparece.
10. Como Administrador Global, acessar a Agenda sem filtro → vê programações de mais de uma congregação (se houver); aplicar o filtro de congregação → lista restringe.
11. Como Leitor, acessar Programações → só consulta (Lista/Calendário/Histórico), sem "Nova Programação", "Editar", "Cancelar" ou "Confirmar Realização".
12. Tentar um `insert`/`update` direto em `programacoes` como Leitor (via SQL simulando `auth.uid()`, ou revisando o texto da policy) → confirma rejeição pela RLS já existente.

## Documentação a atualizar

- `06.1.5 - Programações.md` tem as referências de RN erradas (RN-040/041/042/043/044 em vez de RN-050 a RN-055, ver "Contexto", Achado 1) — fica registrado aqui como pendência; corrigir o documento formal está fora do escopo desta fatia de implementação (mesma decisão já tomada nas fatias anteriores de não editar os documentos de especificação em si).

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_programacoes_indice_data_ativa.sql`
- `src/components/calendario-mensal.tsx`
- `src/features/programacoes/use-programacoes.ts`
- `src/features/programacoes/use-historico-programacao.ts`
- `src/app/(app)/programacoes/index.tsx`
- `src/app/(app)/programacoes/[id].tsx`
- `src/app/(app)/programacoes/nova.tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova aba "Programações".
