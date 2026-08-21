# Suporte — FAQ e Chamados

**Data:** 2026-08-20
**Módulo:** novo (não faz parte dos UCs originais em `docs/06.1.*` — pedido direto do usuário)

---

## Contexto

Durante teste manual, o usuário notou falhas de UX de teclado (corrigidas em commits anteriores) e pediu, na sequência, uma função de suporte: um lugar para tirar dúvidas comuns sem precisar de ajuda (FAQ) e, se não resolver, enviar uma mensagem que o Administrador Global veja e responda.

Não existe módulo de Suporte nos documentos formais (`docs/06.1.1` a `06.1.9`) nem em `08-DER.md`/`11-Permissoes.md` — é escopo novo, definido diretamente com o usuário nesta conversa. Duas decisões já confirmadas com ele:

1. Chamado é **1 pergunta + 1 resposta** (não uma conversa de várias mensagens).
2. FAQ é **fixo no código** por enquanto (não editável pelo Administrador Global via app).

## Não-objetivos

- Conversa com múltiplas mensagens por chamado — v2 se fizer falta na prática.
- FAQ editável via app — v2 se o conteúdo precisar mudar com frequência.
- Notificação (push/e-mail) quando o admin responde — a tabela `notificacoes` já existe no banco (0 linhas, sem uso ainda em nenhuma tela) e é o encaixe natural para isso depois; fora de escopo agora.
- Reabrir chamado / editar a pergunta depois de enviada — usuário insatisfeito com a resposta abre um novo chamado.
- Testes automatizados — projeto ainda sem framework configurado (mesmo padrão das fatias anteriores); verificação manual via Playwright, logado.

## Arquitetura

### Modelo de Dados

Tabela nova `suporte_mensagens`, seguindo a convenção já usada no schema (uuid pk, `criado_em`/`atualizado_em`, `status` varchar com CHECK, trigger `set_atualizado_em` já existente):

```sql
create table public.suporte_mensagens (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios(id),
  assunto        varchar(200) not null,
  mensagem       text not null,
  status         varchar not null default 'Aberto'
                   check (status in ('Aberto', 'Respondido')),
  resposta       text,
  respondido_por uuid references public.usuarios(id),
  respondido_em  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create trigger set_atualizado_em before update on public.suporte_mensagens
  for each row execute function public.set_atualizado_em();
```

RLS (reaproveitando `public.is_administrador_global()`, já usado em todo o schema):

- `select`: `usuario_id = auth.uid() or public.is_administrador_global()` — usuário vê só os próprios chamados; admin vê todos.
- `insert`: `with check (usuario_id = auth.uid())` — usuário só abre chamado em nome dele mesmo.
- `update`: `using (public.is_administrador_global()) with check (public.is_administrador_global())` — só o Administrador Global responde; ninguém edita a pergunta original (sem policy de update para o autor).
- Sem policy de `delete` (mesma convenção de nunca apagar linha usada no resto do schema).

### Frontend

**Nova aba "Suporte"** em `src/components/app-tabs.tsx`/`app-tabs.web.tsx`, visível a todos os perfis.

**Rota nova (flat, mesmo padrão de `temas.tsx`/`usuarios.tsx`):** `src/app/(app)/suporte.tsx`

- **FAQ**: array fixo `PERGUNTAS_FREQUENTES` no próprio arquivo (ou em `src/features/suporte/faq.ts` se passar de ~10 itens), cobrindo só funcionalidade que já existe hoje (login/conta, congregação, usuários/convites, catálogo de temas, oradores). Cada item expande/recolhe ao tocar (estado local `perguntaAbertaId`, sem lib de accordion — mesmo espírito simples já usado no app).
- **Enviar mensagem**: formulário assunto + mensagem (multiline) → `criarMensagem`. Some da vista após enviar; aparece na lista "Meus chamados" abaixo.
- **Meus chamados**: lista dos chamados do usuário (mais recente primeiro), mostrando assunto, mensagem, status, e a resposta quando `status = 'Respondido'`.
- **Administrador Global apenas** — seção extra "Chamados de suporte": lista **todos** os chamados (de todos os usuários, via mesmo `select` — a RLS já filtra), mostrando quem enviou. Como `usuario_id` e `respondido_por` são duas FKs para `usuarios`, o embed precisa desambiguar pelo nome da constraint, mesmo padrão já usado em `congregacao_origem:congregacoes!congregacao_origem_id(...)` em `use-oradores.ts`: `usuario:usuarios!usuario_id(nome, sobrenome)`. Chamados "Aberto" primeiro. Cada um com campo de resposta inline (mesmo padrão ler/editar de `EditarTemaForm`) → `responder(mensagem, respostaTexto)`.

**Hook novo:** `src/features/suporte/use-suporte.ts`
- `mensagens` — um único `select` sem filtro explícito de `usuario_id`; a RLS decide o que volta (só as próprias para usuário comum, todas para admin) — mesmo raciocínio já usado nos outros hooks do projeto.
- `criarMensagem(assunto, mensagem)` — `insert` com `usuario_id: usuario.id`.
- `responder(mensagemId, resposta)` — `update` (`resposta`, `status: 'Respondido'`, `respondido_por: usuario.id`, `respondido_em: new Date().toISOString()`); só é exposto/chamado na seção visível ao Administrador Global — a RLS bloqueia de qualquer forma se alguém tentar por fora da UI.

## Tratamento de erros

| Caso | Origem | Mensagem apresentada |
|---|---|---|
| Assunto ou mensagem vazios | Validação client-side | "Preencha o assunto e a mensagem." |
| Falha ao enviar chamado | Exceção não classificada | "Não foi possível enviar sua mensagem. Tente novamente." |
| Falha ao responder (admin) | Exceção não classificada | "Não foi possível enviar a resposta. Tente novamente." |
| Falha ao carregar chamados | Exceção não classificada | "Não foi possível carregar os chamados." |

## Plano de verificação (manual)

Via `npm run web`, logado com a conta de teste já usada nesta conversa (Administrador Global):

1. Abrir Suporte → FAQ aparece, cada pergunta expande/recolhe ao tocar.
2. Enviar um chamado (assunto + mensagem) → aparece em "Meus chamados" com status "Aberto"; some do formulário.
3. Tentar enviar com campos vazios → mensagem de validação, sem round-trip ao servidor.
4. Como Administrador Global, ver o chamado na seção "Chamados de suporte", responder → status muda para "Respondido", resposta aparece também em "Meus chamados" (mesmo usuário, já que a conta de teste é a mesma que abriu o chamado — simular um segundo usuário via SQL se precisar confirmar o isolamento entre contas).
5. Tentar um `select`/`update` direto em `suporte_mensagens` como usuário sem perfil Administrador Global (via SQL, simulando `auth.uid()` de outro usuário) → confirma que só vê os próprios chamados e não consegue responder.

## Documentação a atualizar

- Nenhuma — Suporte não faz parte de `docs/06.1.*`/`08-DER.md`/`11-Permissoes.md` (ver "Contexto"); é escopo novo tratado só nesta spec.

## Arquivos afetados

**Novos:**
- `database/migrations/<timestamp>_suporte_mensagens.sql`
- `src/features/suporte/use-suporte.ts`
- `src/features/suporte/faq.ts` (conteúdo fixo do FAQ)
- `src/app/(app)/suporte.tsx`

**Modificados:**
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` — nova aba "Suporte".
