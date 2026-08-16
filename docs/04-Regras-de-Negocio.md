# BUSINESS_RULES.md

# Regras de Negócio

> Sistema Inteligente de Programação de Discursos (SIPD)

Versão: 1.0

---

# Objetivo

Este documento define as regras de negócio do Sistema Inteligente de Programação de Discursos (SIPD).

As regras aqui descritas são independentes da tecnologia utilizada e deverão ser respeitadas por qualquer implementação do sistema.

Seu objetivo é garantir consistência entre a documentação, o banco de dados, as APIs, a interface do usuário e a implementação da aplicação.

---

# Organização

As regras estão agrupadas por domínio:

- Usuários
- Congregações
- Oradores
- Temas
- Programações
- Convites
- Confirmações
- Histórico
- Inteligência
- Segurança

---

# Usuários

### RN-001

Todo usuário deverá possuir uma conta autenticada.

---

### RN-002

Cada usuário deverá estar vinculado a exatamente uma congregação.

---

### RN-003

Todo usuário deverá possuir exatamente um Perfil.

O Perfil determina as funcionalidades e permissões disponíveis dentro do sistema.

---

### RN-004

Cada usuário poderá administrar apenas a sua congregação, de acordo com as permissões atribuídas ao seu Perfil.

---

### RN-005

O usuário poderá alterar apenas seus próprios dados pessoais, exceto quando possuir permissão administrativa sobre usuários da sua congregação.

---

### RN-006

O acesso aos dados deverá respeitar integralmente as políticas de segurança definidas pelo sistema.

---

# Perfis

### RN-010

Os perfis disponíveis na versão 1.0 são:

- Administrador Global
- Coordenador
- Editor
- Leitor

---

### RN-011

Todo usuário deverá possuir exatamente um Perfil.

---

### RN-012

As permissões do sistema serão definidas exclusivamente pelo Perfil atribuído ao usuário.

---

# Congregações

### RN-020

Toda congregação deverá possuir um nome.

---

### RN-021

Cada congregação poderá possuir diversos usuários.

---

### RN-022

Cada congregação poderá possuir diversos oradores.

---

### RN-023

Uma congregação poderá convidar oradores pertencentes a qualquer outra congregação cadastrada.

---

### RN-024

Cada congregação poderá possuir diversas programações.

---

### RN-025

Toda congregação deverá possuir um número oficial, único entre as congregações.

---

### RN-026

Toda congregação criada por autoatendimento deve ter, no momento da criação, um usuário vinculado com perfil Coordenador.

---

# Oradores

### RN-030

Todo orador pertence a exatamente uma congregação de origem.

---

### RN-031

Um orador poderá possuir diversos temas preparados.

---

### RN-032

Um orador poderá receber convites de qualquer congregação.

---

### RN-033

O recebimento de um convite não altera sua congregação de origem.

---

### RN-034

O cadastro do orador é global.

---

### RN-035

Um orador poderá reivindicar seu próprio perfil no sistema.

---

### RN-036

Após reivindicar seu perfil, o orador poderá responder convites diretamente pelo sistema.

---

# Temas

### RN-040

Os temas pertencem à base global do sistema.

---

### RN-041

Cada tema deverá possuir um número único, conforme a relação oficial S-99.

---

### RN-042

Cada tema deverá possuir um título oficial, conforme a relação S-99.

---

### RN-043

Cada tema deverá pertencer a uma categoria oficial.

---

### RN-044

Diversos oradores poderão possuir o mesmo tema preparado.

---

# Programações

### RN-050

Toda programação deverá possuir:

- congregação;
- data;
- tema;
- orador;
- status.

---

### RN-051

Não poderá existir mais de uma programação ativa para a mesma congregação na mesma data.

---

### RN-052

Cada programação possuirá apenas um orador principal.

---

### RN-053

Toda programação deverá possuir um Status.

---

### RN-054

Uma programação poderá ser alterada enquanto não estiver concluída ou cancelada.

---

### RN-055

Após realizada, a programação será arquivada para fins históricos.

---

# Convites

### RN-060

Todo convite deverá estar vinculado a uma programação.

---

### RN-061

Todo convite será destinado a apenas um orador.

---

### RN-062

Ao aceitar um convite, o sistema deverá disponibilizar automaticamente o formulário de confirmação.

---

### RN-063

Os estados possíveis de um convite são:

- Enviado
- Aceito
- Recusado
- Cancelado
- Expirado

---

### RN-064

O convite permanecerá registrado no histórico, mesmo após seu cancelamento.

---

# Confirmações

### RN-070

Toda confirmação pertence a exatamente um convite.

---

### RN-071

A confirmação poderá conter:

- cântico inicial;
- utilização de imagens;
- envio de arquivos;
- observações;
- confirmação de permanência até o final da reunião.

---

### RN-072

Arquivos enviados deverão permanecer vinculados à confirmação.

---

### RN-073

Após o envio da confirmação, a programação deverá assumir automaticamente o status **Confirmada**.

---

# Histórico

### RN-080

Toda ação relevante deverá gerar um evento.

---

### RN-081

Todo evento deverá ser registrado permanentemente no histórico.

---

### RN-082

O histórico nunca poderá ser excluído.

---

### RN-083

Cada registro do histórico deverá conter:

- data e hora;
- usuário responsável;
- descrição da ação realizada.

---

# Inteligência

### RN-090

O sistema deverá alertar quando um tema tiver sido utilizado recentemente pela mesma congregação.

O período considerado deverá ser configurável pelo Administrador Global.

---

### RN-091

O sistema deverá alertar quando existir uma programação futura da mesma congregação utilizando o mesmo tema.

---

### RN-092

Ao selecionar um tema, os oradores preparados para esse tema deverão ser apresentados com prioridade.

---

### RN-093

O sistema deverá identificar conflitos antes de permitir o salvamento da programação.

---

### RN-094

O Dashboard deverá apresentar automaticamente todas as pendências relevantes ao usuário.

---

### RN-095

Sempre que possível, as informações deverão ser apresentadas proativamente, reduzindo a necessidade de pesquisas manuais.

---

### RN-096

O sistema deverá sugerir automaticamente possíveis substitutos quando um orador não puder atender ao convite.

---

### RN-097

O sistema deverá identificar programações próximas da data prevista que ainda não possuam confirmação.

---

# Segurança

### RN-100

Nenhum usuário poderá acessar informações administrativas de outra congregação, exceto usuários com Perfil **Administrador Global**.

---

### RN-101

As permissões deverão ser aplicadas tanto na interface quanto nas regras de acesso ao banco de dados.

---

### RN-102

Toda operação crítica deverá ser registrada para fins de auditoria.

---

# Princípios

Toda nova funcionalidade deverá respeitar as regras descritas neste documento.

Caso uma funcionalidade exija alteração de alguma regra existente, este documento deverá ser atualizado antes da implementação correspondente.

---

# Filosofia

As regras de negócio do SIPD têm como principal objetivo automatizar tarefas repetitivas, reduzir erros operacionais e auxiliar os usuários durante todo o processo de programação.

> **O usuário deixa de procurar informação. A informação procura o usuário.**