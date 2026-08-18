# Catálogo de Temas e Categorias (UC-CAT-001 a 006)

**Data:** 2026-08-18
**Módulo:** Catálogo (`06.1.4 - Catálogo_Temas.md`)
**Fora de escopo (fatia futura):** UC-CAT-007 (Importar Catálogo S-99) — ver "Não-objetivos".

---

## Contexto

UC-CAT-001/002 cobrem consulta de Temas e Categorias, liberada a todos os perfis autenticados. UC-CAT-003 a 006 cobrem cadastro/edição de Tema e Categoria, exclusivos do Administrador Global.

`12-API.md` já decide o mecanismo para os 6 UCs desta fatia: tabela direta (PostgREST + RLS), sem RPC — mais simples que o módulo de Congregações, que precisou de RPCs `security definer` para operações privilegiadas. Aqui a única regra de acesso é "todos leem, só Administrador Global escreve", que RLS resolve sozinha.

`08-DER.md`/`09-Dicionario-de-Dados.md` já especificam o schema de `temas` e `categorias` (ver "Modelo de Dados"). Conferimos o PDF oficial `docs/anexos/S-99a_T.pdf` (extraído via `pdftotext`) para validar o formato real: 191 temas numerados (`número. título`, ex. "4. Que provas temos de que Deus existe?"), agrupados em 10 categorias fixas (Bíblia/Deus, Evangelização/Ministério, Família/Jovens, Fé/Espiritualidade, Mundo — não fazer parte do, Provações/Problemas, Qualidades/Padrões Cristãos, Reino/Paraíso, Religião/Adoração, Últimos Dias/Julgamento de Deus). Confirma o schema já documentado; os dados desse PDF ficam para a fatia de importação (UC-CAT-007).

Nenhum UC desta fatia define uma ação de "excluir" Tema/Categoria — só existe a coluna `ativo` no schema. Decisão: tratar isso como ativar/desativar dentro da própria tela de edição, mesmo padrão já usado em Usuários da Congregação (UC-CGR-003) — nunca hard delete.

## Não-objetivos

- UC-CAT-007 (Importar Catálogo S-99) — fatia própria, mais complexa (parsing de fonte externa, validação em lote, preview antes de confirmar). O catálogo nasce vazio nesta fatia; o Administrador Global cadastra manualmente.
- UC de "Excluir" Tema/Categoria — não existe no módulo; ativar/desativar cobre a necessidade (ver "Contexto").
- Alterar `categoria_id` de um Tema para "mesclar" categorias, ou excluir uma Categoria que ainda tenha Temas vinculados — nenhum UC pede isso; um Tema sempre aponta para uma Categoria existente (`RN-043`), e desativar uma Categoria não desativa seus Temas em cascata (decisão consciente — evita efeito surpresa; o Administrador Global desativa os Temas manualmente se for o caso).
- Testes automatizados (projeto ainda sem framework configurado — verificação manual, mesmo padrão das fatias anteriores).

## Arquitetura

### Modelo de Dados

Ambas as tabelas já especificadas em `08-DER.md`/`09-Dicionario-de-Dados.md`:

```sql
create table public.categorias (
  id             uuid primary key default gen_random_uuid(),
  nome           varchar not null,
  descricao      text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint categorias_nome_key unique (nome)
);

create table public.temas (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references public.categorias (id),
  numero         varchar not null,
  titulo         varchar not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint temas_numero_key unique (numero)
);

create index temas_categoria_id_idx on public.temas (categoria_id);
```

`categorias.nome` unique: o DER não marcava isso explicitamente ("Unique: Não definido no DER"), mas a FA-01 de UC-CAT-005 ("Categoria já existente") exige a checagem — preenchendo essa lacuna com uma constraint real, mesmo padrão de gap já preenchido em fatias anteriores.

**RLS** — leitura liberada a todo `authenticated`, mas esconde inativos de quem não é Administrador Global; escrita restrita a Administrador Global (reaproveita `is_administrador_global()`, já existente):

```sql
alter table public.categorias enable row level security;
alter table public.temas enable row level security;

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
```

Sem policy de DELETE em nenhuma das duas tabelas — mesma convenção de nunca fazer hard delete já usada no resto do schema.

Sem trava de coluna via `GRANT` (como foi necessário em `usuarios`): aqui não há campo sensível tipo `id`/FK de identidade que um usuário comum pudesse sequestrar — só Administrador Global tem `UPDATE` de qualquer coluna, então a RLS já basta.

**Novas RNs**: nenhuma — RN-040 a RN-043 já cobrem exatamente essas regras (Temas pertencem à base global, número único, título oficial, categoria obrigatória). RN-102 (histórico) já existente.

### Frontend

**Novo hook `src/features/catalogo/use-categorias.ts`:**
- Lista categorias (via `categorias_select`).
- `criarCategoria(nome, descricao)` → `insert` direto; erro de `unique_violation` em `nome` → mensagem amigável.
- `editarCategoria(categoria, dados)` → `update` direto (nome/descrição/ativo), seguido de `insert` em `historicos` (`categoria_criada`/`categoria_editada` — ver "Tratamento de erros" e nota abaixo sobre histórico só em edição).

**Novo hook `src/features/catalogo/use-temas.ts`:**
- Lista temas (via `temas_select`), com busca client-side por número ou título (catálogo pequeno — 191 temas na relação oficial, `.gt`/`.ilike` no servidor seria over-engineering aqui).
- `criarTema(numero, titulo, categoriaId)` → `insert` direto; erro de `unique_violation` em `numero` → mensagem amigável.
- `editarTema(tema, dados)` → `update` direto (número/título/categoria/ativo), seguido de `insert` em `historicos` (`tema_editado`).

Histórico só em edição, não em criação: `12-API.md`/Matriz de Rastreabilidade de `06.1.4` só listam RN-102 (histórico) para UC-CAT-004/006 (Editar), não para UC-CAT-003/005 (Cadastrar) — reflete o texto literal dos UCs (Pós-condições de Cadastrar não mencionam Histórico, só as de Editar mencionam explicitamente). Seguindo a documentação como está, sem adicionar escopo não pedido.

**Tela nova `src/app/(app)/catalogo.tsx`:**
- Toggle interno "Temas" / "Categorias" (sem rotas separadas — uma tela só, mesmo espírito compacto de `usuarios.tsx`).
- Aba **Temas**: campo de busca (número ou título) + lista (número, título, nome da categoria). Administrador Global vê botão "Novo Tema" e pode tocar um item para editar (modal com número/título/dropdown de categoria — reaproveita o padrão `Dropdown` + `useTheme()` já usado em `usuarios.tsx`/`estado-cidade-picker.tsx` — e switch Ativo/Inativo).
- Aba **Categorias**: lista de nomes + descrição. Administrador Global vê botão "Nova Categoria" e edição (nome/descrição/switch ativo). Tocar uma categoria (qualquer perfil) troca para a aba Temas já filtrada por `categoria_id` — cobre o fluxo de UC-CAT-002 ("sistema apresenta os temas pertencentes à categoria").
- Demais perfis (Editor, Leitor, Coordenador) veem as duas abas só para consulta, sem nenhum botão de gerenciamento — mesmo gate `podeGerenciar` (aqui: `usuario.perfil.nome === 'Administrador Global'`) já usado em `usuarios.tsx`.

**Navegação:** nova aba "Catálogo" em `src/components/app-tabs.tsx` e `app-tabs.web.tsx` (visível a todos os perfis, já que a consulta é liberada a todos).

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Número de tema já cadastrado | `unique_violation` em `temas.numero` | "Já existe um tema com esse número." |
| Nome de categoria já cadastrada | `unique_violation` em `categorias.nome` | "Já existe uma categoria com esse nome." |
| Falha genérica ao salvar (rede, RLS) | Exceção não classificada | "Não foi possível salvar. Tente novamente." |
| Falha ao carregar catálogo | Exceção não classificada | "Não foi possível carregar o catálogo." |

## Plano de verificação (manual)

Via `npm run web`:

1. Como Administrador Global, cadastrar uma Categoria nova → confirmar que aparece na aba Categorias.
2. Tentar cadastrar uma Categoria com o mesmo nome → confirmar mensagem de duplicidade, cadastro não realizado.
3. Cadastrar um Tema novo apontando para essa Categoria → confirmar que aparece na aba Temas, com o nome da Categoria certo.
4. Tentar cadastrar um Tema com o mesmo número → confirmar mensagem de duplicidade.
5. Editar o Tema (trocar título e/ou categoria) → confirmar atualização e registro em `historicos` (`tema_editado`).
6. Desativar o Tema (switch Ativo/Inativo na edição) → confirmar que ele some da consulta para um usuário Editor/Leitor/Coordenador, mas continua visível (com indicação de inativo) para o Administrador Global.
7. Como Editor ou Leitor, acessar Catálogo → confirmar que os botões "Novo Tema"/"Nova Categoria" e a edição não aparecem, só a consulta.
8. Buscar por número e por parte do título na aba Temas → confirmar que o filtro funciona nos dois casos.
9. Na aba Categorias, tocar uma categoria → confirmar que troca para a aba Temas já filtrada por ela.
10. Tentar um `insert`/`update` direto em `temas`/`categorias` como Editor ou Leitor (bypassando a UI, direto pelo client SDK) → confirmar rejeição pela RLS.

## Documentação a atualizar

- `09-Dicionario-de-Dados.md` — adicionar a constraint `categorias_nome_key` (unique) na seção 7 (Categorias), hoje marcada como "Não definido no DER".
- `12-API.md` — nenhuma mudança (mecanismo já documentado corretamente como tabela direta).

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_catalogo_temas_categorias.sql` (tabelas `categorias`/`temas`, RLS)
- `src/features/catalogo/use-categorias.ts`
- `src/features/catalogo/use-temas.ts`
- `src/app/(app)/catalogo.tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova aba "Catálogo".
- `docs/09-Dicionario-de-Dados.md` — ver "Documentação a atualizar".
