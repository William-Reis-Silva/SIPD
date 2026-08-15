# Glossário do Domínio

> Este documento define a linguagem oficial utilizada no projeto SIPD.
>
> Todos os documentos, banco de dados, APIs, interfaces e códigos deverão utilizar estes termos para manter consistência em toda a plataforma.

---

# Objetivo

Padronizar a terminologia utilizada durante o desenvolvimento do SIPD, evitando ambiguidades e garantindo que todos os envolvidos utilizem a mesma linguagem.

---

# Conceitos do Domínio

## Congregação

Representa uma congregação cadastrada no sistema.

Uma congregação pode possuir diversos usuários, oradores e programações.

### Exemplo

```
Congregação Central
```

---

## Usuário

Pessoa autenticada no sistema.

Todo usuário pertence a uma única congregação e possui exatamente um Perfil.

O usuário poderá administrar apenas sua congregação, conforme as permissões atribuídas ao seu perfil.

---

## Perfil

Conjunto de permissões atribuídas a um usuário dentro do SIPD.

Perfis disponíveis:

- Administrador Global
- Coordenador
- Editor
- Leitor

O Perfil determina quais funcionalidades poderão ser acessadas.

---

## Cargo

Função exercida pelo usuário dentro da congregação.

Exemplos:

- Coordenador do Corpo de Anciãos
- Secretário
- Ancião
- Servo Ministerial
- Publicador

O Cargo possui finalidade apenas informativa e não interfere nas permissões do sistema.

---

## Congregação de Origem

Congregação à qual o orador pertence oficialmente.

Cada orador possui exatamente uma congregação de origem.

Essa informação é utilizada para:

- identificar a congregação responsável pelo orador;
- organizar a base global de oradores;
- facilitar pesquisas;
- manter a consistência dos dados.

Um orador poderá receber convites de qualquer congregação.

---

## Administrador Global

Usuário responsável pela administração geral da plataforma.

Possui acesso irrestrito ao sistema.

Entre suas responsabilidades estão:

- administrar congregações;
- administrar usuários;
- administrar perfis;
- manter a base global de temas;
- importar a lista oficial S-99;
- realizar manutenção da plataforma.

---

## Coordenador

Usuário responsável pela administração completa da congregação.

Pode:

- administrar usuários;
- cadastrar oradores;
- criar programações;
- enviar convites;
- consultar relatórios;
- alterar configurações da congregação.

---

## Editor

Usuário responsável pela operação diária do sistema.

Pode:

- cadastrar oradores;
- atualizar temas preparados;
- criar e editar programações;
- enviar convites;
- consultar relatórios.

Não possui permissão para administrar usuários ou alterar configurações da congregação.

---

## Leitor

Usuário com acesso somente para consulta.

Pode visualizar:

- programações;
- oradores;
- temas;
- relatórios;
- histórico.

Não pode alterar informações do sistema.

---

## Orador

Pessoa apta a apresentar discursos públicos.

Cada orador pertence a uma única congregação de origem.

Um orador pode:

- possuir diversos temas preparados;
- receber convites de qualquer congregação;
- aceitar ou recusar convites;
- confirmar detalhes da apresentação;
- manter um histórico de discursos realizados.

O cadastro do orador é global.

Caso possua uma conta no SIPD, seu cadastro poderá ser vinculado ao usuário correspondente.

---

## Perfil Reivindicado

Estado em que o próprio orador assume o controle do seu cadastro.

Antes da reivindicação, seus dados são administrados pelos usuários da congregação.

Após a reivindicação poderá:

- receber convites pelo sistema;
- responder convites;
- atualizar informações permitidas.

---

## Tema

Assunto oficial de um discurso público conforme a relação S-99.

Cada tema possui:

- número;
- título;
- categoria.

Os temas pertencem à Base Global.

---

## Tema Preparado

Relacionamento entre um Orador e um Tema.

Indica que o orador está apto a apresentar determinado discurso.

---

## Programação

Registro que representa um discurso público agendado.

Contém:

- congregação;
- data;
- tema;
- orador;
- status.

É a entidade central do SIPD.

---

## Convite

Solicitação enviada a um Orador para participar de uma Programação.

Estados possíveis:

- Enviado
- Aceito
- Recusado
- Expirado
- Cancelado

---

## Confirmação

Resposta enviada pelo Orador após aceitar um Convite.

Pode conter:

- cântico inicial;
- observações;
- recursos necessários;
- anexos;
- confirmação de presença.

---

## Histórico

Registro permanente das ações realizadas no sistema.

Exemplos:

- programação criada;
- convite enviado;
- convite aceito;
- programação alterada;
- confirmação recebida.

O Histórico nunca poderá ser apagado.

---

## Evento

Qualquer ação relevante executada dentro do sistema.

Pode gerar:

- Histórico;
- Notificações;
- Alertas.

---

## Notificação

Mensagem enviada ao usuário para informar acontecimentos importantes.

Exemplos:

- convite aceito;
- resposta recebida;
- confirmação pendente.

---

## Alerta

Mensagem preventiva emitida pelo Motor de Regras.

Exemplos:

- repetição de tema;
- conflito de data;
- orador indisponível.

Um alerta informa uma situação que merece atenção, mas não necessariamente impede a operação.

---

## Bloqueio

Validação que impede uma operação.

Exemplos:

- programação duplicada;
- dados obrigatórios ausentes;
- violação de regra de negócio.

---

## Motor de Regras

Componente responsável por validar automaticamente as Regras de Negócio antes de qualquer operação.

Entre suas responsabilidades estão:

- validar datas;
- detectar conflitos;
- verificar repetição de temas;
- emitir alertas;
- impedir inconsistências.

---

## Dashboard

Tela inicial do sistema.

Apresenta informações relevantes ao usuário autenticado.

Exemplos:

- convites pendentes;
- confirmações aguardando;
- conflitos;
- indicadores;
- próximos discursos.

---

## Base Global

Conjunto de informações compartilhadas entre todas as congregações.

Exemplos:

- Congregações
- Oradores
- Temas
- Categorias

---

## Dados Locais

Informações específicas da congregação administrada pelo usuário.

Exemplos:

- Programações
- Convites
- Confirmações
- Histórico
- Notificações

---

# Estados do Convite

```
Enviado
   │
   ▼
Aceito
   │
   ▼
Confirmação Recebida
   │
   ▼
Programação Confirmada
```

ou

```
Enviado
   │
   ▼
Recusado
```

ou

```
Enviado
   │
   ▼
Expirado
```

---

# Estados da Programação

```
Planejada
   │
   ▼
Convite Enviado
   │
   ▼
Confirmada
   │
   ▼
Realizada
   │
   ▼
Arquivada
```

---

# Filosofia da Linguagem

Todos os documentos do projeto deverão utilizar exatamente os termos definidos neste Glossário.

Não utilizar sinônimos para as entidades principais.

Exemplos:

✔ Programação

❌ Agenda

❌ Evento

---

✔ Convite

❌ Solicitação

❌ Pedido

---

✔ Tema

❌ Assunto

❌ Discurso

---

✔ Histórico

❌ Log

---

# Convenções de Nome

## Banco de Dados

- programacoes
- congregacoes
- usuarios
- perfis
- oradores
- temas
- convites
- confirmacoes
- historicos
- notificacoes

## Classes

- Programacao
- Congregacao
- Usuario
- Perfil
- Orador
- Convite
- Confirmacao

## APIs

- /programacoes
- /congregacoes
- /usuarios
- /oradores
- /temas
- /convites

---

# Princípio Fundamental

Toda decisão de modelagem, implementação ou documentação deverá respeitar a linguagem definida neste documento.

A padronização da linguagem é um dos pilares da arquitetura do SIPD.