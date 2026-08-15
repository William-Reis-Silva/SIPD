# 05 - Modelo de Domínio

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.1

---

# Objetivo

Este documento descreve o modelo de domínio do Sistema Inteligente de Programação de Discursos (SIPD).

Seu objetivo é definir os principais conceitos, entidades, relacionamentos, responsabilidades e regras do negócio, servindo como base para a modelagem do banco de dados, arquitetura da aplicação, APIs e implementação.

O Modelo de Domínio é independente da tecnologia utilizada.

---

# O que é o Domínio?

O domínio representa o conhecimento do negócio.

Ele descreve como usuários, congregações, oradores e programações interagem para organizar os discursos públicos.

Este documento não descreve detalhes de implementação, banco de dados, interface gráfica ou tecnologias específicas.

---

# Subdomínios

O SIPD é organizado nos seguintes subdomínios:

- Administração
- Cadastro
- Programações
- Convites
- Inteligência

A organização visual destes subdomínios é apresentada no documento **05.1 - Domain Map**.

---

# Entidades

## Usuário

Representa uma pessoa autenticada no sistema.

### Responsabilidades

- acessar o sistema;
- administrar sua congregação conforme suas permissões;
- consultar informações;
- executar operações permitidas pelo seu Perfil.

### Relacionamentos

- pertence a uma Congregação;
- possui exatamente um Perfil;
- poderá estar vinculado a um Orador.

---

## Perfil

Define o conjunto de permissões disponíveis para um Usuário.

Perfis da versão 1.0:

- Administrador Global
- Coordenador
- Editor
- Leitor

Cada usuário possui exatamente um Perfil.

---

## Congregação

Representa uma congregação cadastrada na plataforma.

### Responsabilidades

- manter seus usuários;
- manter seus oradores;
- manter suas programações.

### Relacionamentos

Possui:

- usuários;
- oradores;
- programações.

---

## Orador

Representa um irmão apto a proferir discursos públicos.

O cadastro do Orador é global.

### Responsabilidades

- manter seus temas preparados;
- receber convites;
- responder convites;
- manter histórico de apresentações.

### Relacionamentos

- pertence a uma Congregação de Origem;
- possui diversos Temas Preparados;
- recebe diversos Convites;
- poderá estar vinculado a um Usuário.

O vínculo com um Usuário permitirá que o próprio orador acesse o sistema utilizando sua conta.

---

## Tema

Representa um tema oficial da relação S-99.

### Responsabilidades

- identificar um discurso;
- definir sua categoria.

---

## Tema Preparado

Representa a habilitação de um Orador para apresentar determinado Tema.

É a entidade de relacionamento entre Orador e Tema.

### Responsabilidades

- registrar os temas preparados;
- permitir futuras informações como:

- data de preparação;
- observações;
- status.

### Relacionamentos

- pertence a um Orador;
- referencia um Tema.

---

## Categoria

Agrupa temas oficiais da relação S-99.

Uma Categoria poderá possuir diversos Temas.

---

## Programação

Representa um discurso público agendado.

É a principal entidade operacional do sistema.

### Responsabilidades

- definir data;
- definir congregação;
- definir tema;
- definir orador;
- controlar o ciclo de vida da programação.

### Relacionamentos

- pertence a uma Congregação;
- utiliza um Tema;
- possui um Orador;
- gera Convites;
- gera Histórico.

---

## Convite

Representa um convite enviado a um Orador.

### Responsabilidades

- controlar envio;
- controlar resposta;
- controlar situação.

### Relacionamentos

- pertence a uma Programação;
- pertence a um Orador.

---

## Confirmação

Representa a resposta enviada pelo Orador após aceitar um convite.

Pode conter:

- aceite;
- observações;
- cânticos;
- anexos;
- necessidades especiais.

### Relacionamentos

- pertence a um Convite.

---

## Histórico

Registra todos os acontecimentos relevantes de uma Programação.

Exemplos:

- criação;
- alteração;
- troca de orador;
- confirmação;
- cancelamento;
- realização.

O Histórico é permanente.

---

# Agregados

## Administração

Raiz do agregado:

- Congregação

Controla:

- Usuários;
- Perfis.

---

## Cadastro

Raiz do agregado:

- Orador

Controla:

- Temas Preparados.

---

## Programação

Raiz do agregado:

- Programação

Controla:

- Convites;
- Confirmações;
- Histórico.

---

# Objetos de Valor

## StatusProgramacao

- Planejada
- Convite Enviado
- Confirmada
- Realizada
- Cancelada
- Arquivada

---

## StatusConvite

- Criado
- Enviado
- Aceito
- Recusado
- Cancelado
- Expirado

---

## TipoPerfil

- Administrador Global
- Coordenador
- Editor
- Leitor

---

# Serviços de Domínio

## Serviço de Programações

Responsável por:

- criar programações;
- alterar programações;
- validar conflitos;
- validar regras;
- validar disponibilidade.

---

## Serviço de Convites

Responsável por:

- criar convites;
- enviar convites;
- cancelar convites;
- reenviar convites;
- registrar respostas.

---

## Serviço de Inteligência

Responsável por:

- sugerir oradores;
- sugerir substitutos;
- detectar conflitos;
- identificar repetições de temas;
- identificar pendências;
- gerar indicadores.

---

# Eventos do Domínio

- UsuarioCriado
- CongregacaoCriada
- OradorCadastrado
- TemaAtualizado
- ProgramacaoCriada
- ProgramacaoAlterada
- ConviteEnviado
- ConviteAceito
- ConviteRecusado
- ConfirmacaoRecebida
- ProgramacaoConfirmada
- ProgramacaoCancelada

---

# Invariantes

As seguintes regras nunca poderão ser violadas:

- Todo Usuário pertence a exatamente uma Congregação.
- Todo Usuário possui exatamente um Perfil.
- Toda Programação pertence a uma Congregação.
- Toda Programação possui exatamente um Tema.
- Toda Programação possui exatamente um Orador.
- Todo Convite pertence a uma Programação.
- Toda Confirmação pertence a um Convite.
- Todo Orador pertence a uma única Congregação de Origem.
- Um Orador não poderá possuir o mesmo Tema Preparado mais de uma vez.
- Cada Usuário administra apenas sua Congregação, conforme seu Perfil.
- Não poderá existir duplicidade de Programação ativa para a mesma Congregação na mesma data.

---

# Ciclo de Vida

## Programação

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

## Convite

```
Criado
   │
   ▼
Enviado
   │
 ┌─┴──────────┐
 ▼            ▼
Aceito     Recusado
 │
 ▼
Confirmação
 │
 ▼
Finalizado
```

---

# Linguagem Ubíqua

Todos os termos utilizados na documentação, banco de dados, APIs e código-fonte deverão seguir o Glossário Oficial do projeto.

Novos conceitos deverão ser adicionados ao Glossário antes de serem utilizados na implementação.

---

# Considerações Finais

O Modelo de Domínio representa a principal referência conceitual do SIPD.

Toda evolução do sistema deverá preservar a consistência deste modelo, garantindo que as regras de negócio permaneçam independentes da tecnologia adotada.