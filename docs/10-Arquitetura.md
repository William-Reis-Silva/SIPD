# 10 - Arquitetura

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.2

---

# Objetivo

Este documento descreve a arquitetura técnica do Sistema Inteligente de Programação de Discursos (SIPD).

Seu objetivo é definir como o Modelo de Domínio, as Regras de Negócio, os Casos de Uso e o DER serão implementados em termos de plataforma, camadas, componentes e mecanismos de segurança.

Este documento não redefine o domínio. Ele descreve como a tecnologia escolhida suporta o domínio já definido nos documentos anteriores.

---

# Princípio Orientador

Conforme o **Princípio 9** (`01-Principios.md`):

> O domínio define a tecnologia. As regras de negócio têm prioridade sobre qualquer decisão técnica.

Toda decisão registrada neste documento existe para viabilizar o Modelo de Domínio, as Regras de Negócio e os Casos de Uso já documentados — nunca o contrário.

Também orientam esta arquitetura:

- **Princípio 4** — Uma única fonte da verdade: cada dado tem exatamente um lugar de armazenamento oficial (o banco de dados do SIPD), nunca duplicado entre client e servidor.
- **Princípio 6** — Compartilhamento inteligente: a separação entre Base Global e Dados Locais (RN-100, `02-Glossario.md`) é uma decisão de domínio que a arquitetura implementa via multi-tenancy lógico, não físico.
- **Princípio 8** — Crescimento sem retrabalho: a V1 já é uma aplicação web responsiva (PWA), mas a arquitetura não deve impedir a geração de aplicativos nativos Android/iOS a partir da mesma base de código (Expo) sem reescrever a camada de dados.
- **Princípio 10** — Segurança desde o início: autenticação e autorização não são adicionadas depois; são parte do desenho inicial (ver `# Autorização e Multi-tenancy`).

---

# Visão Geral da Arquitetura

O SIPD segue uma arquitetura **cliente-servidor gerenciado (BaaS)**, com a aplicação web (PWA) se comunicando diretamente com a plataforma Supabase, sem um backend intermediário próprio na V1.

```text
┌──────────────────────────────┐
│   Aplicação Web (PWA)         │
│ (React Native + Expo Web + TS)│
└───────────────┬───────────────┘
                 │
                 │ HTTPS (Supabase Client SDK)
                 ▼
┌────────────────────────────────────────────┐
│                  Supabase                   │
│                                              │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │   Auth      │  │  PostgreSQL + RLS     │  │
│  │ (sessão,    │  │  (dados de domínio,   │  │
│  │  e-mail/    │  │   invariantes,        │  │
│  │  senha)     │  │   funções/triggers)   │  │
│  └────────────┘  └───────────────────────┘  │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │  Storage    │  │  Edge Functions       │  │
│  │ (anexos de  │  │  (operações que       │  │
│  │  confirma-  │  │   exigem privilégio   │  │
│  │  ção)       │  │   elevado ou lógica   │  │
│  │             │  │   entre congregações) │  │
│  └────────────┘  └───────────────────────┘  │
└──────────────────────────────────────────────┘
```

Não existe, na V1, um backend próprio separado do Supabase. A validação de regras de negócio críticas é responsabilidade do banco de dados (constraints, triggers e funções PostgreSQL) e de Edge Functions, nunca apenas do cliente web.

---

# Stack Tecnológica

## Frontend (aplicação web / PWA)

| Tecnologia | Finalidade |
|------------|------------|
| React Native | Framework de UI, compilado via Expo para o alvo Web como PWA na V1 |
| Expo | Toolchain de build; gera o build Web (PWA) na V1 e, futuramente, builds nativos Android/iOS a partir do mesmo código |
| Expo Web / Service Worker | Empacota o build Web como PWA instalável, com manifest e cache offline |
| TypeScript | Tipagem estática, alinhada às entidades do Modelo de Domínio |

A V1 do SIPD é entregue como aplicação web responsiva, instalável via PWA em celulares e desktops direto do navegador — sem necessidade de loja de aplicativos. O uso do Expo (em vez de um framework web puro) é o que permite, futuramente, gerar aplicativos nativos Android/iOS a partir da mesma base de código, sem reescrita (Princípio 8).

## Backend / Plataforma

| Tecnologia | Finalidade |
|------------|------------|
| Supabase Auth | Autenticação, sessão e recuperação de senha |
| PostgreSQL | Armazenamento relacional, conforme `08-DER.md` |
| Row Level Security (RLS) | Isolamento de dados por Congregação e por Perfil |
| Supabase Storage | Armazenamento de arquivos anexados às Confirmações |
| Edge Functions | Lógica de servidor que não pode residir apenas no cliente ou apenas em RLS |

## Por que Supabase

A escolha do Supabase decorre diretamente de necessidades já definidas no domínio, não de preferência tecnológica isolada:

- o modelo de Perfis (RN-010 a RN-012) e o isolamento por Congregação (RN-100, RN-101) mapeiam diretamente para **Row Level Security** do PostgreSQL;
- a exigência de autenticação obrigatória (RN-001) e a recuperação de senha (UC-ADM-002) são cobertas nativamente pelo **Supabase Auth**;
- os anexos de Confirmação (RN-072, `06.1.6-Convites.md`) exigem armazenamento de arquivos, coberto pelo **Supabase Storage**;
- o crescimento previsto para V2 (apps nativos Android/iOS) é viabilizado sem reescrever a camada de dados, pois o mesmo banco PostgreSQL com RLS é consumido pelos builds nativos gerados a partir do mesmo código Expo.

---

# Arquitetura em Camadas

## Camada de Apresentação (Web / PWA)

Responsável pela interface com o usuário e pela primeira linha de validação (feedback imediato), mas **nunca a única linha de validação**.

- Componentes de UI (telas, formulários, listas).
- Camada de estado da aplicação.
- Cliente Supabase (SDK) para autenticação, consultas e mutações.

## Camada de Domínio (Cliente)

Réplica, no cliente, das validações do Modelo de Domínio e das Regras de Negócio que impactam a experiência do usuário — por exemplo, alertar sobre repetição de tema (RN-090) antes mesmo de o usuário tentar salvar.

Essa camada existe por usabilidade (Princípio 1 e 3 — antecipar problemas), mas é sempre **redundante** em relação à validação do servidor, nunca substituta dela.

## Camada de Dados e Regras (Servidor)

Onde as invariantes do domínio (`05-Modelo-de-Dominio.md`, seção Invariantes) são garantidas de forma que nenhum cliente, autorizado ou não, possa violá-las:

- **Constraints do PostgreSQL** — chaves estrangeiras, `UNIQUE`, `NOT NULL`, conforme `08-DER.md` (ex.: `UNIQUE (congregacao_id, data)` em `programacoes`).
- **Triggers e funções PostgreSQL** — regras que envolvem lógica além de uma constraint simples (ex.: RN-073 "após envio da confirmação, a programação assume status Confirmada automaticamente").
- **RLS Policies** — quem pode ler/escrever cada linha, conforme Perfil e Congregação.
- **Edge Functions** — operações que precisam de privilégio elevado (ex.: `service_role`) ou que coordenam múltiplas tabelas/side-effects de forma atômica (ex.: enviar um Convite e criar a Notificação correspondente).

---

# Autenticação e Sessão

A autenticação (UC-ADM-001 a UC-ADM-004) é implementada pelo **Supabase Auth**, com e-mail e senha como mecanismo da V1.

```text
Aplicação Web (PWA)
    │
    ▼
Supabase Auth (auth.users)
    │  cria/valida sessão
    ▼
Trigger: on auth.users insert
    │  cria linha correspondente
    ▼
usuarios (tabela de domínio)
    │  congregacao_id, perfil_id, nome...
    ▼
Sessão autenticada + Perfil identificado
```

- `auth.users` (gerenciada pelo Supabase) guarda apenas as credenciais e o identificador de autenticação.
- `usuarios` (tabela de domínio, `08-DER.md`) guarda os dados de negócio: Congregação, Perfil, nome.
- Um trigger de banco associa `auth.users.id` a `usuarios.id` no momento do cadastro, garantindo que RN-001 ("todo usuário deverá possuir uma conta autenticada") e RN-003 ("todo usuário deverá possuir exatamente um Perfil") sejam satisfeitas desde a criação da conta.

A recuperação de senha (UC-ADM-002) usa o fluxo nativo do Supabase Auth, que não revela se um e-mail está cadastrado — cumprindo a exigência de resposta genérica por segurança já descrita naquele Caso de Uso.

---

# Autorização e Multi-tenancy

## Modelo de isolamento

O SIPD é multi-tenant **lógico**: todas as congregações compartilham o mesmo banco de dados, isoladas por `congregacao_id` e reforçadas por RLS — não há um banco de dados por congregação.

Essa decisão decorre diretamente do domínio: RN-023 e RN-032 permitem que um Orador receba convites de qualquer congregação, o que exige que os dados sejam consultáveis entre congregações sob regras específicas — algo que multi-tenancy físico (um banco por congregação) tornaria inviável.

## Dados Globais vs. Dados Locais

Reaproveitando a separação já definida em `02-Glossario.md` e `08-DER.md`:

| Escopo | Tabelas | Política de acesso |
|--------|---------|---------------------|
| **Base Global** | estados, cidades, congregacoes, oradores, temas, categorias | Leitura liberada a todo usuário autenticado; escrita restrita a Administrador Global (RN-100), exceto cadastro de Orador (Coordenador/Editor também podem, `06.1.3`) |
| **Dados Locais** | usuarios, programacoes, convites, confirmacoes, historicos, notificacoes | Leitura e escrita restritas por `congregacao_id`, via RLS |

## RLS como mecanismo de enforcement

RN-101 exige que "as permissões deverão ser aplicadas tanto na interface quanto nas regras de acesso ao banco de dados". Isso é implementado como:

```text
Requisição do cliente
        │
        ▼
Supabase verifica auth.uid()
        │
        ▼
RLS Policy consulta usuarios
        │  (congregacao_id do usuário autenticado)
        │  (perfil_id do usuário autenticado)
        ▼
┌─────────────────────────┐
│                         │
Linha pertence à          Linha pertence a
congregação do usuário    outra congregação
│                         │
▼                         ▼
Permitido (conforme       Negado, exceto se
Perfil)                   Perfil = Administrador
                           Global (RN-100)
```

A interface (camada de apresentação) também esconde ações não permitidas, mas isso é usabilidade — a garantia de segurança real é a RLS Policy no banco.

## Perfis e permissões

Os quatro Perfis (RN-010) mapeiam para políticas RLS diferenciadas por operação (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) em cada tabela de Dados Locais:

- **Administrador Global** — bypassa o isolamento por congregação (RN-100).
- **Coordenador** — leitura e escrita completas dentro da própria congregação.
- **Editor** — leitura e escrita operacional dentro da própria congregação (sem gestão de usuários/configurações).
- **Leitor** — apenas leitura dentro da própria congregação.

A matriz completa de permissões por Caso de Uso será detalhada em `11-Permissoes.md`.

---

# Motor de Regras

O `05-Modelo-de-Dominio.md` define o Motor de Regras como o componente responsável por validar Regras de Negócio antes de qualquer operação. Na arquitetura, ele não é um serviço único, mas uma responsabilidade distribuída:

| Tipo de regra | Exemplo | Onde é aplicada |
|----------------|---------|------------------|
| Bloqueio estrutural | RN-051 (duplicidade de programação por data) | Constraint `UNIQUE` no PostgreSQL |
| Bloqueio de fluxo | RN-093 (impedir salvar programação com conflito) | Função/trigger PostgreSQL, chamada antes do `INSERT` |
| Efeito colateral automático | RN-073 (confirmação enviada → programação Confirmada) | Trigger PostgreSQL |
| Alerta não bloqueante | RN-090, RN-091 (repetição de tema) | Função PostgreSQL (RPC) consultada pelo cliente antes de salvar |
| Sugestão | RN-096 (sugerir substitutos) | Função PostgreSQL (RPC) ou Edge Function, consumida pelo módulo de Inteligência |

Bloqueios (que impedem a gravação) são sempre reforçados no banco. Alertas e sugestões (que não impedem, apenas informam) podem ser calculados sob demanda via funções RPC do PostgreSQL, chamadas diretamente pelo cliente Supabase.

---

# Módulo de Inteligência

O módulo de Inteligência (`06.1.9-Inteligência.md`) é determinístico — consultas e regras sobre dados existentes, sem aprendizado de máquina (ver `STATUS.md`, achado #3).

Arquiteturalmente, cada Caso de Uso UC-INT-* é implementado como uma função PostgreSQL (RPC) ou uma view, nunca como um serviço externo:

- `UC-INT-001` (Sugerir Oradores) → função RPC que aplica os critérios de RN-021, RN-022, RN-095 sobre `temas_preparados`, `historicos` e `programacoes`.
- `UC-INT-002` (Detectar Conflitos) → função RPC chamada antes de `INSERT`/`UPDATE` em `programacoes`.
- `UC-INT-005` (Dashboard) → view ou função agregadora consultada ao abrir o app.

Isso mantém a Inteligência como parte da Camada de Dados e Regras (servidor), evitando duplicar a lógica no cliente e coerente com o Princípio 4 (uma única fonte da verdade).

---

# Armazenamento de Arquivos

Anexos de Confirmação (RN-072, cântico/imagens/arquivos) são armazenados no **Supabase Storage**, em buckets segregados por congregação, com policies de acesso equivalentes às RLS Policies do banco (mesmo critério: `congregacao_id` do usuário autenticado).

A tabela `confirmacoes` (`08-DER.md`) armazena apenas a referência ao arquivo, nunca o binário.

---

# Edge Functions

Reservadas para operações que **não podem** ser expressas apenas como RLS Policy ou trigger, por exigirem coordenação entre múltiplas tabelas com privilégio elevado ou comunicação com serviços externos:

- Envio de Convite (UC-CONV-002): cria o registro em `convites`, atualiza o status e cria a `notificacao` correspondente como uma operação atômica.
- Importação do Catálogo S-99 (UC-CAT-007): processa um arquivo e aplica alterações em lote em `temas`/`categorias`, com validação prévia.

Operações de CRUD simples (consultar, criar, editar um registro dentro do escopo do Perfil) **não** passam por Edge Function — o cliente usa o SDK Supabase diretamente contra o PostgreSQL, protegido por RLS.

---

# Notificações

Na V1, o mecanismo de notificação é a tabela `notificacoes` (`08-DER.md`), consultada dentro do próprio aplicativo — não há push notification nem WhatsApp, conforme "Fora do Escopo (V1)" em `03-PRD.md`.

A estrutura já prevê a tabela `notificacoes` desacoplada do mecanismo de entrega, permitindo que a V2 adicione push notifications sem alterar o modelo de dados.

---

# Evolução Futura

Decisões desta arquitetura que preparam, sem antecipar, a evolução prevista em `03-PRD.md`:

| Versão futura | O que já está preparado |
|----------------|---------------------------|
| V2 — Apps nativos Android/iOS | O mesmo código Expo que gera o build Web (PWA) da V1 pode ser compilado como app nativo via EAS, sem duplicar regras de negócio (que vivem no servidor) |
| V2 — Notificações push | Tabela `notificacoes` já desacoplada do canal de entrega |
| V2 — Compartilhamento entre congregações | Já suportado pelo modelo de Base Global (Orador, Tema) |
| V3 — Inteligência Artificial | O módulo de Inteligência já isola a lógica de sugestão em funções RPC, substituíveis por um serviço de IA sem alterar os Casos de Uso |

Nenhuma dessas evoluções deverá ser implementada na V1. Elas são citadas aqui apenas para justificar por que a arquitetura evita decisões que as bloqueariam (Princípio 8).

---

# Considerações Finais

A arquitetura do SIPD prioriza um único ambiente de dados (PostgreSQL + RLS) como fonte da verdade e limite de segurança, com a aplicação web (PWA) como cliente fino que delega toda validação crítica ao servidor.

Este documento deverá permanecer alinhado a `05-Modelo-de-Dominio.md`, `04-Regras-de-Negocio.md`, `06.1.x` (Casos de Uso) e `08-DER.md`/`09-Dicionario-de-Dados.md`. Alterações de schema ou de política de segurança deverão ser refletidas simultaneamente nesses documentos.

O detalhamento de permissões por Perfil e Caso de Uso está em `11-Permissoes.md`. O detalhamento de endpoints e funções RPC está em `12-API.md`. Decisões arquiteturais específicas, com alternativas consideradas e trade-offs, serão registradas individualmente em `13-ADR.md`.
