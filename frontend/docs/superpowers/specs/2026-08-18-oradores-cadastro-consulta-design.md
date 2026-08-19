# Oradores — Cadastro, Consulta, Temas Preparados e Histórico (UC-ORA-001 a 006)

**Data:** 2026-08-18
**Módulo:** Oradores (`06.1.3 - Oradores.md`)
**Fora de escopo (fatia futura):** UC-ORA-007 (Vincular Conta ao Orador) — ver "Não-objetivos".

---

## Contexto

`06.1.3` define 7 Casos de Uso. Esta fatia cobre os 6 primeiros — cadastro, edição, consulta, temas preparados (registrar/atualizar) e histórico do orador. UC-ORA-007 (Vincular Conta ao Orador) fica para uma fatia própria: é um fluxo de identidade (reivindicação de cadastro por telefone, RPC nova `security definer`) qualitativamente diferente do CRUD administrativo coberto aqui — mesmo raciocínio que separou Completar Cadastro dos Dados Básicos de Congregações.

**Achado ao planejar esta fatia:** as tabelas `oradores` e `temas_preparados` **já existem**, criadas em `database/migrations/20260812130000_replace_prototype_with_der_schema.sql` junto com o restante do schema do DER — e a RLS de lá **já bate exatamente** com a Matriz de Permissões de `11-Permissoes.md` (Administrador Global, Coordenador e Editor podem inserir/editar; todos os autenticados leem; sem policy de DELETE). Diferente do Catálogo, não há RLS para revisar aqui.

`12-API.md` confirma tabela direta (PostgREST + RLS) para os 6 UCs desta fatia, sem RPC nova.

## Não-objetivos

- UC-ORA-007 (Vincular Conta ao Orador) — fatia própria (ver "Contexto"). Nesta fatia, o cadastro do orador mostra apenas um indicador informativo "Conta vinculada" / "Sem conta vinculada" (`usuario_id is not null`), sem nenhuma ação para alterá-lo.
- Excluir Orador ou Tema Preparado — não existe nos UCs; `ativo` cobre desativação de Orador. Tema Preparado não tem coluna `ativo` no DER — "remover" (UC-ORA-005) é DELETE real da linha de relacionamento, não soft-delete (é um vínculo, não uma entidade com ciclo de vida próprio; o Tema em si nunca é apagado).
- Programações, Convites, Confirmações — não existem ainda. A seção "Histórico" desta fatia consulta dados reais de `historicos` (ver "Modelo de Dados"), mas fica com conteúdo limitado a eventos administrativos até o módulo de Programações existir.
- Testes automatizados — projeto ainda sem framework configurado, verificação manual (mesmo padrão das fatias anteriores).

## Arquitetura

### Modelo de Dados

`oradores` e `temas_preparados` já existem com exatamente as colunas de `08-DER.md`/`09-Dicionario-de-Dados.md` e RLS já correta (ver "Contexto"). Duas adições nesta fatia:

**1. Trigger de trava condicional em `congregacao_origem_id`** (UC-ORA-002 FA-02: "a alteração da congregação de origem deverá ser tratada como uma operação administrativa específica"). Decisão revisada com o usuário: Coordenador/Editor continuam podendo editar esse campo normalmente (a RLS de `oradores_update` não muda) **enquanto o orador não tiver conta vinculada**; a partir do momento em que `usuario_id` é preenchido (mesmo que isso só aconteça na Fatia 2), só o próprio orador (`usuario_id = auth.uid()`) ou o Administrador Global podem alterar `congregacao_origem_id`. Como RLS não compara valor antigo vs. novo de uma coluna específica dentro do mesmo `UPDATE`, isso exige uma trigger:

```sql
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
      raise exception 'Apenas o próprio orador vinculado pode alterar a congregação de origem.';
    end if;
  end if;
  return new;
end;
$$;

create trigger travar_origem_orador_vinculado
  before update on public.oradores
  for each row execute function public.travar_origem_orador_vinculado();
```

**2. Normalização de telefone** — `oradores.telefone_normalizado` já tem `UNIQUE`, mas a normalização é responsabilidade da aplicação (`08-DER.md`, "Telefone do Orador"). Não existe utilitário parecido no frontend ainda (`usuarios.telefone` guarda texto livre, sem normalizar). Novo util puro `src/features/oradores/telefone.ts`:

- `normalizarTelefone(valor: string): string | null` — remove tudo que não é dígito; se tiver 10 ou 11 dígitos (DDD + número, padrão BR sem código do país), prefixa `55`; se já tiver 12–13 dígitos começando com `55`, mantém; caso contrário retorna `null` (inválido).
- `formatarTelefone(normalizado: string): string` — para exibição, formato `(11) 99999-1111`.

**Novas RNs:** nenhuma — RN-034 (cadastro global), RN-035/036 (fora de escopo aqui), RN-020/021/022/023/024 (as referenciadas pelos UCs de Oradores são na verdade as RNs de Congregações reaproveitadas: qualquer congregação pode ter diversos oradores/ser convidada, já implementadas), RN-082 (histórico nunca é excluído — já vale por não existir DELETE em `historicos`), RN-102 (auditoria) já cobrem o necessário.

### Convenção de Histórico (`historicos`)

`historicos` não tem coluna `orador_id` (só `programacao_id` e `usuario_id`) — mesma situação já enfrentada por Tema/Categoria no Catálogo, resolvida com `usuario_id: null` + `orador_id` dentro de `dados` (jsonb). Sigo a mesma convenção:

- Cadastrar Orador (UC-ORA-001, lista RN-102) → `tipo: 'orador_criado'`
- Editar Orador (UC-ORA-002, lista RN-102) → `tipo: 'orador_editado'`
- Registrar Tema Preparado — "adicionar" isolado (UC-ORA-004, **não** lista RN-102) → sem log, mesmo padrão do "criar" no Catálogo
- Atualizar/Remover Tema Preparado (UC-ORA-005, lista RN-102; cobre adicionar/atualizar/remover como operações) → `tipo: 'tema_preparado_editado'` / `'tema_preparado_removido'` para as operações de editar observações e remover (a operação de adicionar já é coberta por UC-ORA-004 acima, sem log — evita logar a mesma ação duas vezes por ela aparecer nos dois UCs)

Todos com `dados: { orador_id: ... , ...campos relevantes }`.

A tela de Histórico do Orador (UC-ORA-006) consulta:

```sql
select * from historicos where dados->>'orador_id' = :oradorId order by criado_em desc
```

Isso dá conteúdo real desde o primeiro cadastro (não fica vazio à toa) e continua funcionando sem mudança quando Programações/Convites/Confirmações passarem a gravar eventos citando o mesmo orador — desde que sigam a mesma convenção (`dados->>'orador_id'`), o que fica registrado aqui como padrão a seguir.

### Frontend

**Nova aba "Oradores"** em `src/components/app-tabs.tsx`/`app-tabs.web.tsx`, visível a todos os perfis (consulta é liberada a todos — UC-ORA-003).

**Estrutura de rotas** (pasta nova, diferente do padrão flat de `temas.tsx`/`usuarios.tsx` — aqui o volume de dados por orador justifica tela de detalhe própria):

```
src/app/(app)/oradores/
  index.tsx   — lista (rota /oradores, alvo da aba)
  [id].tsx    — detalhe (rota /oradores/[id])
  novo.tsx    — cadastro (rota /oradores/novo)
```

**`oradores/index.tsx`:**
- Campo de busca (nome/sobrenome ou telefone, client-side — mesmo raciocínio do Catálogo, mas aqui a base pode crescer bastante; se a lista ficar grande o bastante para incomodar, filtro server-side (`ilike`) é troca local sem mudar a interface do hook).
- Dropdown opcional "Filtrar por tema" — usa `useTemas()` do Catálogo para popular; ao selecionar, filtra oradores que têm aquele tema preparado via embed do PostgREST (`temas_preparados!inner(tema_id)`), cobrindo a FA-01 de UC-ORA-003.
- Cada item da lista mostra nome completo, congregação de origem, cidade.
- Botão "Novo Orador" (topo) visível só para Administrador Global, Coordenador, Editor — `podeGerenciar`, mesmo gate já usado em `usuarios.tsx`/`catalogo.tsx`.
- Toque num item navega para `/oradores/[id]`.

**`oradores/[id].tsx`** — três seções na mesma tela (sem sub-rotas):
- **Dados**: nome, sobrenome, telefone formatado, email, cidade (nome + UF), congregação de origem, e linha informativa "Conta vinculada" / "Sem conta vinculada" (somente leitura). `podeGerenciar` vê um botão "Editar" que troca a seção para modo formulário inline (mesmo padrão ler/editar de `congregacao.tsx`, não modal — o formulário é grande o bastante, com `EstadoCidadePicker`, para justificar isso). Confirma → `UPDATE` + log `orador_editado` (ver "Convenção de Histórico").
- **Temas Preparados**: lista de temas do orador (número + título); `podeGerenciar` vê um "×" por item (remove com confirmação, log `tema_preparado_removido`) e um botão "Adicionar Tema" que abre um dropdown de busca sobre `useTemas()` filtrado a `ativo = true` e excluindo os já vinculados; adicionar não loga histórico (ver convenção).
- **Histórico**: lista cronológica (mais recente primeiro) dos eventos de `historicos` filtrados por `dados->>'orador_id'` (ver "Convenção de Histórico"). Estado vazio: "Nenhum evento registrado ainda." Visível a todos os perfis autenticados (UC-ORA-006 libera consulta a todos).

**`oradores/novo.tsx`** — formulário: nome, sobrenome, telefone (com normalização/validação via `telefone.ts` antes do submit), email (opcional), `EstadoCidadePicker` (cidade de residência — componente já existente, reaproveitado tal como está), dropdown de congregação de origem (busca sobre `congregacoes` já carregadas, sem opção de criar — diferente do `EstadoCidadePicker`, que permite criar cidade nova; toda congregação de origem já existe no sistema). Confirma → `INSERT` + log `orador_criado`.

**Hooks novos:**
- `src/features/oradores/use-oradores.ts` — lista (com busca e filtro por tema), `criarOrador`, `editarOrador`, busca por id.
- `src/features/oradores/use-temas-preparados.ts` — por orador: listar, adicionar, editar observações, remover.
- `src/features/oradores/use-historico-orador.ts` — consulta por `dados->>'orador_id'`.
- `src/features/oradores/telefone.ts` — `normalizarTelefone`/`formatarTelefone` (função pura, sem estado).

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Telefone já cadastrado | `unique_violation` em `oradores.telefone_normalizado` | "Já existe um orador com esse telefone." |
| Telefone inválido | Validação client-side (`normalizarTelefone` retorna `null`) | "Informe um telefone válido, com DDD." |
| Tema já preparado | `unique_violation` em `temas_preparados (orador_id, tema_id)` | "Esse tema já está entre os preparados do orador." (defesa extra — a UI já esconde temas já adicionados) |
| Trocar congregação de origem sem permissão | Exceção da trigger `travar_origem_orador_vinculado` | "Apenas o próprio orador vinculado pode alterar a congregação de origem." |
| Falha genérica ao salvar (rede, RLS) | Exceção não classificada | "Não foi possível salvar. Tente novamente." |
| Falha ao carregar lista/detalhe | Exceção não classificada | "Não foi possível carregar os oradores." |

## Plano de verificação (manual)

Via `npm run web`:

1. Como Coordenador ou Editor, cadastrar um Orador novo (nome, telefone, cidade, congregação de origem) → aparece na lista, evento `orador_criado` no Histórico dele.
2. Tentar cadastrar outro Orador com o mesmo telefone → mensagem de duplicidade, cadastro não realizado.
3. Tentar cadastrar com telefone inválido (poucos dígitos) → mensagem de validação, sem round-trip ao servidor.
4. Editar os dados do Orador (nome, telefone, cidade) → confirma atualização e evento `orador_editado` no Histórico.
5. Como Coordenador/Editor, trocar a congregação de origem de um Orador **sem** conta vinculada → permitido.
6. Simular um Orador **com** `usuario_id` preenchido (via SQL, já que Vincular Conta é da Fatia 2) e tentar trocar a congregação de origem como Coordenador/Editor → bloqueado pela trigger; como Administrador Global → permitido.
7. Adicionar um Tema Preparado ao Orador → aparece na seção, sem novo evento no Histórico (UC-ORA-004 isolado não loga).
8. Remover um Tema Preparado → some da seção, evento `tema_preparado_removido` no Histórico.
9. Buscar oradores por nome e por telefone na lista → confirma que o filtro funciona nos dois casos.
10. Filtrar a lista por um Tema específico → confirma que só aparecem oradores com aquele tema preparado.
11. Como Leitor, acessar Oradores → confirma que só há consulta (sem "Novo Orador", sem edição, sem gerenciar temas preparados), mas Histórico continua visível.
12. Tentar um `insert`/`update` direto em `oradores`/`temas_preparados` como Leitor (bypassando a UI, direto pelo client SDK) → confirma rejeição pela RLS existente.
13. Tentar um `delete` direto em `oradores` como Administrador Global (bypassando a UI) → confirma rejeição (nenhuma policy de DELETE, RLS já existente).

## Documentação a atualizar

- Nenhuma mudança em `08-DER.md`/`09-Dicionario-de-Dados.md`/`12-API.md` — schema, RLS-base e mecanismo já documentados corretamente. A trigger nova é um detalhe de implementação da regra já descrita em UC-ORA-002 FA-02, não uma regra nova.

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_oradores_cadastro_consulta.sql` (trigger `travar_origem_orador_vinculado` — tabelas/RLS já existentes, ver "Contexto")
- `src/features/oradores/use-oradores.ts`
- `src/features/oradores/use-temas-preparados.ts`
- `src/features/oradores/use-historico-orador.ts`
- `src/features/oradores/telefone.ts`
- `src/app/(app)/oradores/index.tsx`
- `src/app/(app)/oradores/[id].tsx`
- `src/app/(app)/oradores/novo.tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova aba "Oradores".
