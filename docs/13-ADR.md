# 13 - ADR (Architecture Decision Records)

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.0

---

# Objetivo

Este documento registra, no formato padrão de ADR (Architecture Decision Record), as decisões arquiteturais e de produto significativas do SIPD.

As entradas abaixo não são decisões novas — são a formalização retroativa de decisões que já estão implícitas e implementadas em `10-Arquitetura.md`, `03-PRD.md`, `02-Glossario.md`, `04-Regras-de-Negocio.md` e no histórico de `STATUS.md`. O objetivo de registrá-las aqui, isoladamente, é preservar o **porquê** de cada decisão (contexto, alternativas descartadas, trade-offs aceitos), que tende a se perder quando fica disperso em prosa dentro de outros documentos.

Daqui em diante, toda nova decisão arquitetural relevante deverá ganhar uma entrada própria neste documento (ADR-010 em diante), em vez de ser narrada apenas no changelog de `STATUS.md`.

---

# Convenção

- **Numeração:** sequencial e permanente. Um ADR nunca é renumerado nem excluído.
- **Status possíveis:**
  - **Aceita** — decisão vigente.
  - **Substituída** — decisão revogada por um ADR posterior; a entrada permanece no documento, com um ponteiro para o ADR que a substituiu.
  - **Obsoleta** — decisão que deixou de se aplicar (ex.: por mudança de escopo), sem um substituto direto.
- Cada entrada cita o(s) documento(s)-fonte onde a decisão está implementada, para permitir verificação cruzada.

---

# Registro de Decisões

## ADR-001 — Arquitetura BaaS (Supabase) sem backend próprio

**Status:** Aceita

**Contexto**

A V1 do SIPD precisa de autenticação, armazenamento relacional com invariantes fortes, armazenamento de arquivos e isolamento de dados por Congregação, com prazo e equipe reduzidos para construir e operar um backend próprio.

**Decisão**

Adotar Supabase como plataforma BaaS (Backend as a Service): a aplicação web (PWA) se comunica diretamente com Supabase (Auth, PostgreSQL + RLS, Storage, Edge Functions), sem um servidor de aplicação intermediário próprio (ver `10-Arquitetura.md`, "Visão Geral da Arquitetura" e "Por que Supabase").

**Alternativas consideradas**

- Backend próprio (ex.: Node.js/API REST customizada sobre um PostgreSQL gerenciado) — descartado por exigir construir e manter manualmente autenticação, autorização e camada de API que o Supabase já oferece prontas, sem ganho correspondente para os requisitos da V1.
- Outro BaaS (ex.: Firebase) — não documentado explicitamente nas fontes; descartado implicitamente porque o modelo de dados do SIPD é fortemente relacional (múltiplas entidades com integridade referencial — `08-DER.md`), o que favorece PostgreSQL sobre um banco documentos/NoSQL.

**Consequências**

- Positivo: elimina a necessidade de operar infraestrutura de servidor própria; autenticação, RLS e Storage vêm prontos e alinhados aos requisitos do domínio.
- Positivo: o mesmo banco PostgreSQL + RLS é reutilizável pelos futuros apps nativos (V2), sem duplicar a camada de dados.
- Negativo: acopla o SIPD à plataforma Supabase; qualquer migração futura de provedor exigiria reavaliar RLS, Auth e Edge Functions.

---

## ADR-002 — RLS como camada de segurança real, não apenas validação de interface

**Status:** Aceita

**Contexto**

RN-101 exige que "as permissões deverão ser aplicadas tanto na interface quanto nas regras de acesso ao banco de dados". Uma aplicação cliente (PWA) rodando no navegador do usuário não pode ser a única barreira de segurança, pois seu código e suas requisições são inspecionáveis e manipuláveis pelo próprio usuário.

**Decisão**

Toda autorização por Perfil e por Congregação é reforçada por Row Level Security (RLS) Policies no PostgreSQL. A camada de apresentação também oculta ações não permitidas, mas apenas por usabilidade — a garantia de segurança real está nas RLS Policies (ver `10-Arquitetura.md`, "RLS como mecanismo de enforcement").

**Alternativas consideradas**

- Validação de permissão apenas na aplicação cliente — descartado por violar diretamente RN-101 e por ser trivialmente contornável.
- Validação de permissão em uma camada de API própria (backend intermediário) — descartada como consequência direta do ADR-001 (sem backend próprio); nesse modelo, RLS é o único ponto onde o enforcement pode viver de forma confiável.

**Consequências**

- Positivo: a segurança independe da correção do código cliente; um cliente malicioso ou desatualizado não consegue burlar o isolamento por Congregação/Perfil.
- Positivo: uma única política de acesso (a RLS Policy) serve tanto para o cliente PWA quanto para futuros clientes nativos (V2), sem duplicação de lógica.
- Negativo: exige que toda regra de autorização seja expressável como policy SQL, e testada diretamente no banco — a lógica de permissão fica menos visível para quem só lê o código do cliente.

---

## ADR-003 — Motor de Regras como funções PostgreSQL determinísticas, sem Inteligência Artificial na V1

**Status:** Aceita

**Contexto**

O Modelo de Domínio (`05-Modelo-de-Dominio.md`) prevê um "Motor de Regras" responsável por validações, alertas e sugestões (RN-090 a RN-097). Era preciso decidir onde essa lógica reside tecnicamente, e se ela envolveria aprendizado de máquina — `03-PRD.md` já lista "Inteligência Artificial" e "Sugestões automáticas" explicitamente fora do escopo da V1 (seção "Fora do Escopo (V1)"), reservados para a Versão 3.

**Decisão**

O Motor de Regras é implementado inteiramente como funções PostgreSQL (RPC), triggers e views — nunca como um serviço externo ou modelo de aprendizado de máquina. Todo o módulo de Inteligência (`06.1.9`) é determinístico: consultas e regras de negócio sobre dados existentes, com a decisão final sempre do usuário (ver `10-Arquitetura.md`, "Motor de Regras" e "Módulo de Inteligência"; verificado sem conflito com o PRD em `STATUS.md`, achado #3).

**Alternativas consideradas**

- Serviço externo de IA/ML para sugestões (ex.: recomendação de oradores) — explicitamente fora do escopo da V1 em `03-PRD.md`, reservado para a Versão 3.
- Lógica de regras duplicada no cliente (sem função central no banco) — descartada por violar o Princípio 4 (uma única fonte da verdade) e por permitir que bloqueios fossem contornados por um cliente que não replicasse a validação.

**Consequências**

- Positivo: mantém a Inteligência como parte da Camada de Dados e Regras (servidor), sem duplicar lógica no cliente.
- Positivo: por já isolar a lógica de sugestão em funções RPC substituíveis, a evolução para IA na V3 não exige reescrever os Casos de Uso (`10-Arquitetura.md`, "Evolução Futura").
- Negativo: sugestões e alertas ficam limitados ao que é expressável como consulta/regra determinística — nenhum aprendizado a partir de padrões de uso é possível na V1.

---

## ADR-004 — PWA (Expo Web) como alvo principal da V1, nativos Android/iOS como evolução V2

**Status:** Aceita

**Data:** 2026-08-09

**Contexto**

A documentação inicial (`00-Visao-do-Projeto.md`, `03-PRD.md`, `10-Arquitetura.md`) descrevia a V1 como um aplicativo mobile nativo (Android/iOS). O usuário confirmou explicitamente que a intenção real do produto sempre foi uma aplicação web responsiva desde o início, sem depender de lojas de aplicativo para a V1 (registrado em `STATUS.md`, achado #5).

**Decisão**

Manter React Native + Expo como stack, mas com o **build Web do Expo (PWA instalável)** como alvo principal e único da V1. Aplicativos nativos Android/iOS passam a ser evolução V2, gerados a partir da mesma base de código, sem reescrita (`03-PRD.md`, seção "Plataforma"; `10-Arquitetura.md`, "Stack Tecnológica").

**Alternativas consideradas**

- Aplicativo nativo Android/iOS desde a V1 (opção original, descartada) — exigiria publicação em lojas de aplicativo e maior tempo até o primeiro usuário conseguir usar o sistema, incompatível com a intenção real do produto.
- Aplicação web pura, sem Expo (ex.: framework web tradicional) — descartada porque perderia a possibilidade de gerar os apps nativos da V2 a partir do mesmo código, forçando uma reescrita futura (contraria o Princípio 8).

**Consequências**

- Positivo: usuários acessam a V1 direto do navegador, instalável como PWA, sem fricção de loja de aplicativos.
- Positivo: a mesma base de código Expo permanece pronta para gerar builds nativos na V2, sem retrabalho na camada de dados ou de regras.
- Negativo: recursos exclusivos de plataforma nativa (ex.: notificações push nativas) ficam indisponíveis até a V2, quando os builds nativos existirem.

---

## ADR-005 — Modelo de 4 Perfis fixos, sem permissões granulares por usuário

**Status:** Aceita

**Contexto**

O sistema precisa de um modelo de autorização simples o suficiente para ser implementado inteiramente via RLS (ADR-002), cobrindo os diferentes níveis de responsabilidade dentro de uma Congregação e da plataforma como um todo.

**Decisão**

Adotar um conjunto fechado de 4 Perfis — Administrador Global, Coordenador, Editor, Leitor — que determinam exclusivamente as permissões de um Usuário (RN-010, RN-012). Não existem permissões customizadas por usuário individual. Cargo (ex.: Secretário, Ancião) é puramente informativo e não interfere em permissões (`02-Glossario.md`, "Perfil" e "Cargo").

**Alternativas consideradas**

- Permissões granulares por usuário (ACL individual) — não documentada explicitamente nas fontes como tendo sido avaliada; descartada implicitamente, pois RN-012 fixa a autorização exclusivamente pelo Perfil, e um modelo de 4 Perfis fixos é diretamente mapeável para políticas RLS por tabela, o que uma ACL arbitrária por usuário tornaria mais complexo de expressar e auditar.

**Consequências**

- Positivo: cada RLS Policy só precisa verificar `perfil_id` do usuário autenticado contra uma lista fechada de 4 valores — implementação e auditoria simples.
- Positivo: a matriz de permissões inteira é enumerável e documentável de forma exaustiva (`11-Permissoes.md`), o que não seria viável com permissões arbitrárias por usuário.
- Negativo: casos excepcionais (ex.: um Editor que precise de uma permissão isolada de Coordenador) não são resolvíveis dentro do modelo — exigiriam mudar o Perfil do usuário inteiro ou criar um Perfil novo.

---

## ADR-006 — Orador como entidade independente de Usuário e Perfil

**Status:** Aceita

**Contexto**

Nem toda pessoa apta a proferir discursos possui, ou precisa possuir, uma conta de acesso ao sistema — o cadastro de Orador é majoritariamente mantido por outra pessoa (Coordenador/Editor da Congregação).

**Decisão**

Orador é uma entidade própria do domínio, desacoplada de Usuário e Perfil. Um Orador pode existir inteiramente sem conta de acesso; quando decide reivindicar seu cadastro, pode vincular uma conta de Usuário ao seu registro de Orador (RN-034, RN-035, RN-036) e passar a interagir diretamente com convites e confirmações — sem que isso exija ou implique possuir um dos 4 Perfis do sistema (`02-Glossario.md`, "Orador"; `06.1.3 - Oradores.md`, UC-ORA-007).

**Alternativas consideradas**

- Tratar Orador como um Perfil do sistema — era o modelo presente em versões anteriores de `00-Visao-do-Projeto.md`/`03-PRD.md`/`05.2`, corrigido em 2026-08-09 (`STATUS.md`, achado #1) justamente por misturar duas responsabilidades distintas: "quem pode proferir um discurso" (Orador) e "o que um usuário autenticado pode fazer no sistema" (Perfil).

**Consequências**

- Positivo: permite cadastrar e gerenciar oradores sem depender de eles terem — ou quererem — uma conta no sistema, refletindo a realidade operacional das congregações.
- Positivo: quando um Orador se vincula, suas ações (aceitar/recusar convite, enviar confirmação) ficam claramente identificadas como ações da identidade do Orador, não de um Perfil administrativo.
- Negativo: exige modelar e manter dois conceitos de "pessoa" no sistema (Usuário e Orador) com uma relação opcional entre eles, em vez de um único modelo de usuário unificado.

---

## ADR-007 — Multi-tenancy lógico por `congregacao_id`, com Administrador Global como única exceção de escopo

**Status:** Aceita

**Contexto**

Cada Congregação deve ter seus dados operacionais isolados das demais (RN-004, RN-100), mas o domínio também exige que um Orador possa receber convites de qualquer Congregação (RN-023, RN-032) — o que implica que alguma consulta entre Congregações precisa ser possível.

**Decisão**

Multi-tenancy **lógico**, não físico: todas as Congregações compartilham o mesmo banco PostgreSQL, isoladas por uma coluna `congregacao_id` e reforçadas por RLS. O Administrador Global é a única exceção autorizada a acessar dados administrativos de qualquer Congregação (RN-100; `10-Arquitetura.md`, "Modelo de isolamento").

**Alternativas consideradas**

- Um banco de dados por Congregação (multi-tenancy físico) — descartado explicitamente em `10-Arquitetura.md` por tornar inviáveis as consultas entre Congregações exigidas por RN-023/RN-032 (ex.: um Orador de uma Congregação receber convite de outra).

**Consequências**

- Positivo: consultas entre Congregações (convites cruzados, base global de Oradores) são naturais, sem replicação de dados ou sincronização entre bancos.
- Positivo: um único conjunto de RLS Policies cobre todas as Congregações, simplificando manutenção e auditoria.
- Negativo: um erro em uma RLS Policy tem potencial de vazar dados entre todas as Congregações simultaneamente — o "raio de explosão" de uma falha de isolamento é maior do que em bancos fisicamente separados.

---

## ADR-008 — Base de Temas e Categorias como catálogo global único (S-99)

**Status:** Aceita

**Contexto**

Os temas de discurso seguem uma relação oficial externa (S-99) comum a todas as congregações, não uma lista definida individualmente por cada uma.

**Decisão**

Temas e Categorias pertencem à Base Global do sistema (RN-040 a RN-043): cadastro único, não replicado por Congregação, com leitura liberada a todo usuário autenticado e escrita restrita ao Administrador Global (`02-Glossario.md`, "Base Global"; `10-Arquitetura.md`, "Dados Globais vs. Dados Locais").

**Alternativas consideradas**

- Cada Congregação manter sua própria cópia local do catálogo de Temas — não documentada como cogitada; descartada implicitamente, pois duplicaria um catálogo oficial idêntico entre todas as Congregações, violando o Princípio 4 (uma única fonte da verdade) e complicando a importação/atualização da relação S-99.

**Consequências**

- Positivo: a importação do Catálogo S-99 (UC-CAT-007) atualiza a base uma única vez para todo o sistema.
- Positivo: "Tema Preparado" (a relação Orador↔Tema) permanece local e específica, sem exigir que o catálogo em si seja duplicado.
- Negativo: qualquer erro ou atraso na atualização do catálogo global afeta todas as Congregações simultaneamente, sem isolamento entre elas.

---

## ADR-009 — Uso restrito de Edge Functions, reservado a operações privilegiadas ou atômicas

**Status:** Aceita

**Contexto**

Nem toda operação pode ser expressa apenas como RLS Policy/trigger: algumas exigem privilégio elevado (`service_role`) ou precisam coordenar múltiplas tabelas como uma transação atômica com efeito colateral.

**Decisão**

Edge Functions são usadas exclusivamente para essas operações — ex.: enviar Convite (cria `convites` + `notificacoes` atomicamente) e importar o Catálogo S-99 (processa arquivo, valida e aplica em lote). Toda operação de CRUD simples (consultar, criar, editar um registro dentro do escopo do Perfil) passa direto pelo SDK Supabase contra o PostgreSQL, protegida por RLS — nunca por Edge Function (`10-Arquitetura.md`, "Edge Functions"; `12-API.md`, tabela de classificação de mecanismo).

**Alternativas consideradas**

- Rotear todas as operações por Edge Functions, por uniformidade — descartada explicitamente em `10-Arquitetura.md`: adicionaria uma camada de execução desnecessária ao CRUD simples, que RLS já protege sozinho, sem ganho de segurança ou consistência.

**Consequências**

- Positivo: a maioria das operações (CRUD simples) tem latência menor, por não passar por uma camada de execução adicional.
- Positivo: o uso de `service_role` fica concentrado em um pequeno conjunto de Edge Functions auditáveis, em vez de espalhado pelo sistema.
- Negativo: exige, em cada novo Caso de Uso, decidir explicitamente se ele se qualifica como Edge Function ou não — um critério mal aplicado pode tanto sub-proteger uma operação sensível quanto adicionar complexidade desnecessária a uma operação simples.

---

## ADR-010 — Convite de usuário por código/link manual, sem Edge Function/e-mail transacional

**Status:** Aceita

**Contexto**

`12-API.md` (nota 2) e o `ADR-009` previam que convidar um novo usuário (UC-CGR-003) exigiria uma Edge Function usando a Supabase Auth Admin API (`inviteUserByEmail`), já que criar credenciais em `auth.users` só é possível com `service_role`. Ao planejar a implementação, verificou-se que o projeto Supabase não tem SMTP customizado configurado (toggle ligado, mas sem host/remetente preenchidos) nem domínio próprio — apenas hospedagem gratuita (`.web.app`/`.vercel.app`), cujo DNS não pode ser usado para autenticar envio de e-mail transacional. Como o SIPD é um projeto sem fins lucrativos, comprar um domínio só para isso foi descartado.

**Decisão**

UC-CGR-003 usa um mecanismo de convite por **código/link gerado e compartilhado manualmente** (RPC `security definer`, mesmo padrão de `completar_cadastro_congregacao`), em vez de Edge Function + e-mail. O convidado recebe o código/link por fora do sistema (ex.: WhatsApp) e o usa para vincular sua conta à congregação.

**Alternativas consideradas**

- Edge Function + Supabase Auth Admin API (`inviteUserByEmail`), como originalmente previsto — descartada por depender de e-mail transacional real, que exige domínio próprio verificado num provedor de SMTP (Resend, SendGrid etc.), custo recorrente incompatível com o caráter sem fins lucrativos do projeto.

**Consequências**

- Positivo: nenhuma dependência de infraestrutura de e-mail — funciona com o que o projeto já tem.
- Positivo: mesmo padrão de RPC `security definer` já usado em outras fatias, sem introduzir Edge Functions no projeto.
- Negativo: o compartilhamento do link é manual (fora do sistema), sem confirmação automática de identidade do destinatário — mitigado por um código de 8 caracteres com validade de 7 dias.
- Negativo: diverge do que `12-API.md`/`ADR-009` previam para este UC especificamente; ambos os documentos foram atualizados para refletir esta decisão.

---

## ADR-011 — Convite de Orador respondido por link público com token, sem autenticação

**Status:** Aceita

**Contexto**

`06.1.6 - Convites.md` (UC-CONV-005/006/007) assume que o Orador responde ao convite autenticado, via conta vinculada (RN-035/036, UC-ORA-007 "Vincular Conta ao Orador"). Essa vinculação nunca foi implementada — não há RPC, nem UI, nem portal autenticado para um Orador puro (que, por decisão de arquitetura, nunca tem `Perfil`). O mecanismo real já usado manualmente pelas congregações (WhatsApp com datas em aberto + Google Forms) não exige login.

**Decisão**

O Orador responde ao convite por um **link público com token** (`/convite/{token}`, UUID de alta entropia), sem sessão autenticada. As RPCs de resposta (`consultar_convite_publico`, `responder_convite_publico`, `enviar_confirmacao_convite_publico`) são `security definer` e concedidas ao papel `anon` — a identidade do respondente é a posse do token da URL, não uma conta.

**Alternativas consideradas**

- Construir UC-ORA-007 (Vincular Conta ao Orador) e um portal autenticado para o Orador antes desta fatia — descartada por ampliar significativamente o escopo sem necessidade: o fluxo manual que este módulo substitui (WhatsApp + Google Forms) já opera sem login, então autenticação não é um requisito real do problema, só uma suposição da especificação original.

**Consequências**

- Positivo: nenhuma dependência de UC-ORA-007; o Orador responde no mesmo nível de fricção do fluxo manual que está sendo substituído.
- Positivo: mesmo padrão `security definer` já usado no projeto, sem Edge Functions.
- Negativo: diverge de ADR-010, que optou pelo oposto (exigir sessão autenticada) para o convite de usuário da congregação (`convites_usuario`) — há inclusive uma migração (`20260818012300`) revogando acesso `anon` naquele fluxo. A distinção é deliberada: `convites_usuario` concede acesso a dados internos da congregação (exige identidade verificável), enquanto o Convite de Orador só expõe dados do próprio convite, protegidos pela posse de um token de alta entropia.
- Negativo: sem confirmação automática de identidade do Orador — mitigado pelo token UUID (não adivinhável) e pela validade de 7 dias.

---

# Considerações Finais

Este registro cobre as decisões arquiteturais e de produto já refletidas na documentação existente até a data de sua elaboração. Ele não substitui `10-Arquitetura.md` (que descreve a arquitetura de forma corrente) nem `STATUS.md` (que registra o histórico de correções de consistência) — complementa ambos, preservando especificamente o raciocínio por trás de cada decisão estrutural.

Toda decisão arquitetural relevante tomada a partir de agora deverá ser registrada aqui como uma nova entrada ADR-NNN, mantendo a numeração sequencial e nunca reescrevendo ou removendo uma entrada existente — apenas marcando-a como Substituída ou Obsoleta quando deixar de valer.
