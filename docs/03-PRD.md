# PRD.md
# Product Requirements Document

> Sistema Inteligente de Programação de Discursos (SIPD)

Versão: 1.2

---

# Objetivo

Este documento descreve os requisitos funcionais e não funcionais do SIPD.

Seu objetivo é definir claramente as funcionalidades que compõem o produto, servindo como referência para desenvolvimento, testes, documentação e evolução do sistema.

---

# Visão Geral

O SIPD é uma plataforma desenvolvida para auxiliar secretários e coordenadores na organização das programações de discursos públicos.

O sistema automatiza tarefas repetitivas, reduz erros operacionais, mantém histórico das atividades e auxilia na tomada de decisões por meio de validações e sugestões inteligentes.

---

# Público-Alvo

O sistema é destinado principalmente a:

- Usuários com Perfil Administrador Global;
- Usuários com Perfil Coordenador;
- Usuários com Perfil Editor;
- Usuários com Perfil Leitor;
- Oradores (quando vincularem seu cadastro a um Usuário).

---

# Perfis de Usuário

Conforme o Glossário do Domínio, o **Perfil** determina as permissões do Usuário dentro do SIPD. **Cargo** (ex.: Secretário, Ancião, Servo Ministerial) é uma informação apenas descritiva da função exercida na congregação e não interfere nas permissões do sistema.

## Administrador Global

Responsável pela manutenção dos dados compartilhados da plataforma.

Exemplos:

- Congregações
- Temas e Categorias
- Usuários
- Perfis
- Correções cadastrais

---

## Coordenador

Responsável pela administração completa da congregação.

Principais atividades:

- cadastrar oradores;
- criar programações;
- enviar convites;
- acompanhar respostas;
- consultar histórico;
- administrar usuários da congregação;
- alterar configurações da congregação.

---

## Editor

Responsável pela operação diária do sistema dentro da congregação.

Principais atividades:

- cadastrar oradores;
- atualizar temas preparados;
- criar e editar programações;
- enviar convites;
- consultar relatórios.

Não possui permissão para administrar usuários ou alterar configurações da congregação.

---

## Leitor

Acesso somente para consulta às informações da congregação.

Pode visualizar programações, oradores, temas, relatórios e histórico. Não pode alterar dados.

---

## Orador

Pessoa cadastrada como apta a proferir discursos públicos. Não é um Perfil de acesso — é uma entidade própria do domínio, que pode existir sem possuir conta no sistema.

Quando o cadastro é vinculado a um Usuário (reivindicação de perfil), o Orador poderá:

- receber convites;
- aceitar ou recusar convites;
- enviar confirmação;
- consultar histórico de convites.

---

# Funcionalidades

## Dashboard

O sistema deverá apresentar um painel inicial contendo:

- próximas programações;
- convites pendentes;
- confirmações aguardando;
- alertas;
- conflitos encontrados;
- sugestões do sistema.

---

## Congregações

Permitir:

- cadastrar congregações;
- editar congregações;
- consultar congregações;
- localizar congregações.

---

## Oradores

Permitir:

- cadastrar oradores;
- editar cadastro;
- consultar oradores;
- pesquisar por nome;
- pesquisar por tema preparado;
- visualizar histórico.

---

## Temas

Permitir:

- consultar temas;
- pesquisar temas;
- organizar por categorias;
- importar relação oficial S-99.

---

## Programações

Permitir:

- criar programação;
- editar programação;
- cancelar programação;
- consultar programação;
- pesquisar por período;
- pesquisar por congregação;
- visualizar calendário.

---

## Convites

Permitir:

- enviar convite;
- cancelar convite;
- reenviar convite;
- acompanhar status;
- consultar histórico.

---

## Confirmações

Permitir ao orador informar:

- cântico inicial;
- utilização de imagens;
- envio de arquivos;
- permanência até o final da reunião;
- observações.

---

## Histórico

Permitir consultar:

- convites enviados;
- respostas;
- alterações;
- eventos importantes;
- histórico de temas.

---

## Relatórios

Permitir gerar:

- programação por período;
- histórico de discursos;
- utilização de temas;
- histórico de convites.

---

## Inteligência

O sistema deverá:

- identificar conflitos;
- alertar repetição de temas;
- sugerir oradores;
- apresentar pendências;
- destacar informações importantes;
- auxiliar na tomada de decisões.

---

# Requisitos Não Funcionais

## Plataforma

- Web responsiva (PWA) — plataforma principal da V1, instalável em celulares e desktops direto do navegador.
- Android e iOS nativos ficam como evolução futura, gerados a partir da mesma base de código (Expo), sem reescrita.

---

## Tecnologias

Frontend

- React Native (via Expo)
- Expo — build Web como alvo principal da V1 (PWA)
- TypeScript

Backend

- Supabase
- PostgreSQL

---

## Segurança

- Autenticação obrigatória.
- Controle de acesso por perfil.
- Row Level Security (RLS).
- Comunicação criptografada.

---

## Desempenho

O sistema deverá responder rapidamente às principais operações e suportar crescimento gradual da base de dados.

---

## Disponibilidade

Os dados deverão permanecer sincronizados entre os dispositivos do usuário.

---

# Critérios de Aceitação

O produto será considerado funcional quando permitir:

- cadastrar congregações;
- cadastrar oradores;
- cadastrar temas;
- criar programações;
- enviar convites;
- receber confirmações;
- consultar histórico;
- identificar conflitos automaticamente.

---

# Escopo da Versão 1

Inclui:

- autenticação;
- congregações;
- oradores;
- temas;
- programações;
- convites;
- confirmações;
- dashboard;
- histórico.

---

# Fora do Escopo (V1)

- WhatsApp
- Push Notifications
- Inteligência Artificial
- Portal Web
- Compartilhamento automático entre congregações
- Integração com Google Calendar

---

# Evolução Prevista

Versão 2

- Portal do Orador
- Compartilhamento entre congregações
- Dashboard Analítico
- Notificações
- Aplicativos nativos Android/iOS (gerados a partir da mesma base Expo)

Versão 3

- Inteligência Artificial
- Sugestões automáticas
- Assistente de programação
- Relatórios inteligentes
- Recomendações baseadas em histórico

---

# Objetivo Final

Construir uma plataforma inteligente que reduza o trabalho operacional dos secretários, automatize tarefas repetitivas e organize as programações de forma simples, segura e eficiente.

---

> **O secretário deixa de procurar informação. A informação procura o secretário.**