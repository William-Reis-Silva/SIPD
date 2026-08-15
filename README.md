## SIPD
## Sistema Inteligente de Programação de Discursos


> **"O secretário deixa de procurar informação. A informação procura o secretário."**

---

# Visão

SIPD

Sistema Inteligente de Programação de Discursos

Uma plataforma web progressiva (PWA) desenvolvida para auxiliar secretários e coordenadores na organização das programações de discursos públicos.

Construído sobre uma arquitetura orientada ao domínio (Domain-Driven Design), priorizando automação, simplicidade e compartilhamento inteligente de informações entre congregações.

Mais do que um aplicativo para cadastro de informações, o SIPD foi concebido para reduzir tarefas repetitivas, evitar erros humanos e transformar dados em decisões.


---

# Nossa Missão

Simplificar a organização das programações, automatizando processos repetitivos e oferecendo ao secretário todas as informações necessárias no momento certo.

O objetivo do SIPD não é apenas armazenar dados.

Nosso objetivo é construir um sistema que acompanhe o fluxo de trabalho do secretário, antecipando problemas, sugerindo soluções e reduzindo a necessidade de conferências manuais.

---

# Filosofia do Projeto

Acreditamos que computadores existem para executar tarefas repetitivas.

As pessoas existem para tomar decisões.

Por isso, sempre que possível, o SIPD deverá:

- automatizar verificações;
- prevenir erros;
- organizar informações;
- manter histórico;
- sugerir alternativas;
- facilitar decisões.

Em outras palavras:

> **O secretário deixa de procurar informação. A informação procura o secretário.**

---

# Objetivos

- Simplificar a criação de programações.
- Reduzir erros humanos.
- Automatizar tarefas repetitivas.
- Centralizar informações importantes.
- Manter histórico confiável.
- Compartilhar conhecimento entre congregações (quando aplicável).
- Construir uma plataforma preparada para crescer.

---

# Funcionalidades da Primeira Versão

## Cadastro Global

- Congregações
- Oradores
- Temas (S-99)

## Programações

- Criar programação
- Editar programação
- Excluir programação
- Histórico

## Convites

- Envio de convite
- Aceite
- Recusa
- Confirmação
- Histórico

## Inteligência

- Alerta de repetição de tema
- Alerta de conflito de programação
- Sugestão automática de oradores
- Painel de pendências
- Histórico inteligente

---

# Funcionalidades Futuras

- Aplicativos nativos Android/iOS (a partir da mesma base Expo)
- Aplicativo do Orador
- Compartilhamento entre congregações
- Dashboard Analítico
- Notificações Push
- Integração com WhatsApp
- Inteligência Artificial
- Assistente de Programação

---

# Arquitetura

```
              React Native (Expo) — build Web (PWA)

                          │

                          ▼

                     Supabase Cloud

        ┌────────────────────────────────┐
        │                                │
        │ PostgreSQL                     │
        │ Authentication                 │
        │ Storage                        │
        │ Row Level Security (RLS)       │
        │ Edge Functions                 │
        │ Realtime                       │
        │                                │
        └────────────────────────────────┘
```

---

# Estrutura do Projeto

```
sipd/

├── docs/
│
├── backend/
│
├── frontend/
│
├── database/
│
├── assets/
│
└── README.md
```

---

# Documentação

Toda a documentação do projeto encontra-se na pasta `docs`.

| Documento | Objetivo |
|------------|----------|
| 00-Visao-do-Projeto.md | Visão geral do sistema |
| 01-Principios.md | Filosofia e princípios do projeto |
| 02-Glossario.md | Linguagem oficial do domínio |
| 03-PRD.md | Requisitos do produto |
| 04-Regras-de-Negocio.md | Regras funcionais |
| 05-Modelo-de-Dominio.md | Modelo conceitual |
| 06-Casos-de-Uso.md | Casos de uso |
| 07-Fluxos.md | Fluxos do sistema |
| 08-DER.md | Modelo do banco de dados |
| 09-Dicionario-de-Dados.md | Definição das tabelas |
| 10-Arquitetura.md | Arquitetura técnica |
| 11-Permissoes.md | Perfis e permissões |
| 12-API.md | Documentação da API |
| 13-ADR.md | Registro das decisões de arquitetura |
| 14-Roadmap.md | Planejamento do desenvolvimento |
| 15-Ideias-Futuras.md | Evolução do sistema |

---

# Tecnologias

## Frontend (Web / PWA)

- React Native
- Expo — build Web como alvo principal da V1 (PWA instalável)
- TypeScript
- Expo Router
- NativeWind

## Backend

- Supabase
- PostgreSQL
- Authentication
- Storage
- Edge Functions
- Realtime
- Row Level Security (RLS)

---

# Princípios de Desenvolvimento

Antes de implementar qualquer funcionalidade, fazemos as seguintes perguntas:

- Resolve um problema real?
- Simplifica o trabalho do secretário?
- Evita erros?
- Reduz tarefas repetitivas?
- Mantém a simplicidade do sistema?
- Está preparada para crescer?

Se a resposta for **não** para qualquer uma dessas perguntas, a funcionalidade deve ser reavaliada.

---

# Fluxo de Desenvolvimento

Toda funcionalidade segue o mesmo processo.

```
Ideia

↓

Discussão

↓

Regra de Negócio

↓

Arquitetura

↓

Modelo de Dados

↓

Documentação

↓

Implementação

↓

Testes

↓

Entrega
```

---

# Roadmap

O desenvolvimento será realizado em etapas.

1. Fundação
2. Cadastros Globais
3. Programações
4. Convites
5. Motor de Regras
6. Dashboard Inteligente
7. Relatórios
8. Integrações
9. Aplicativo do Orador
10. Inteligência Artificial

---

# Contribuição

Antes de qualquer implementação:

1. A necessidade é discutida.
2. A regra de negócio é documentada.
3. A arquitetura é revisada.
4. O modelo de dados é atualizado.
5. A implementação é iniciada.

Isso garante que o projeto permaneça consistente à medida que evolui.

---

# Licença

A definir.

---

# Manifesto

O SIPD nasceu da necessidade de tornar a programação das reuniões mais simples, segura e eficiente.

Nosso compromisso é desenvolver um sistema que trabalhe a favor do usuário, automatizando tarefas repetitivas e oferecendo informações relevantes no momento certo.

Mais do que um aplicativo, queremos construir uma plataforma preparada para evoluir, compartilhar conhecimento e facilitar o trabalho daqueles que dedicam seu tempo à organização das programações.

---

> **"O secretário deixa de procurar informação. A informação procura o secretário."**
