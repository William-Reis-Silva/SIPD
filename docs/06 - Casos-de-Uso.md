# 06 - Casos de Uso

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.4

---

# Objetivo

Este documento descreve as funcionalidades do SIPD sob a perspectiva dos seus atores.

Cada Caso de Uso representa uma interação entre um ator e o sistema para alcançar um objetivo específico.

Este documento serve como base para:

- desenvolvimento da aplicação;
- definição dos fluxos do sistema;
- modelagem do banco de dados;
- implementação das APIs;
- elaboração dos testes;
- definição das permissões;
- rastreabilidade das funcionalidades.

---

# Escopo

Os Casos de Uso descritos neste documento contemplam as funcionalidades previstas para a versão 1.0 do SIPD.

Novas funcionalidades deverão ser adicionadas em versões futuras deste documento.

---

# Visão Geral

Os Casos de Uso representam as funcionalidades disponíveis no SIPD.

Cada Caso de Uso deverá definir:

- ator principal;
- objetivo;
- permissões necessárias;
- pré-condições;
- fluxo principal;
- fluxos alternativos;
- pós-condições;
- regras de negócio relacionadas;
- entidades envolvidas.

Os detalhes de cada Caso de Uso serão documentados nos arquivos específicos dos respectivos módulos.

---

# Atores

## Usuário

Pessoa autenticada no sistema.

Um Usuário possui exatamente um Perfil e pertence a uma Congregação.

Perfis disponíveis na versão 1.0:

- Administrador Global;
- Coordenador;
- Editor;
- Leitor.

As ações disponíveis ao Usuário dependem das permissões do seu Perfil.

Um Usuário também poderá estar vinculado a um Orador.

---

## Orador

Pessoa cadastrada como apta a proferir discursos públicos.

O Orador poderá existir sem possuir uma conta de acesso ao sistema.

Quando possuir uma conta, o cadastro do Orador poderá ser vinculado ao respectivo Usuário.

O Orador poderá:

- receber convites;
- aceitar convites;
- recusar convites;
- enviar confirmações;
- consultar informações permitidas sobre suas apresentações.

---

## Sistema

Representa os processos automáticos executados pelo SIPD.

Exemplos:

- validações;
- alertas;
- sugestões;
- notificações;
- geração de indicadores;
- detecção de conflitos;
- registro de histórico.

O Sistema não substitui os atores humanos. Ele executa automaticamente operações previstas pelas regras de negócio.

---

# Convenções

Todos os Casos de Uso serão identificados pelo seguinte padrão:

```text
UC-XXX-NNN
```

Onde:

- **UC** = Caso de Uso;
- **XXX** = módulo;
- **NNN** = sequência numérica.

Exemplo:

```text
UC-ORA-001
```

---

# Prefixos

| Prefixo | Módulo |
|---------|--------|
| ADM | Administração |
| CGR | Congregações |
| ORA | Oradores |
| CAT | Catálogo |
| PRO | Programações |
| CONV | Convites |
| REL | Relatórios |
| CONF | Configurações |
| INT | Inteligência |

---

# Inventário dos Casos de Uso

## Administração

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-ADM-001 | Autenticar Usuário | Usuário |
| UC-ADM-002 | Recuperar Senha | Usuário |
| UC-ADM-003 | Alterar Senha | Usuário |
| UC-ADM-004 | Encerrar Sessão | Usuário |
| UC-ADM-005 | Gerenciar Usuários | Usuário |
| UC-ADM-006 | Gerenciar Perfis | Usuário |
| UC-ADM-007 | Gerenciar Permissões | Administrador Global |

---

## Congregações

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-CGR-001 | Consultar Congregação | Usuário |
| UC-CGR-002 | Atualizar Dados da Congregação | Coordenador, Administrador Global |
| UC-CGR-003 | Gerenciar Usuários da Congregação | Coordenador, Administrador Global |

---

## Oradores

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-ORA-001 | Cadastrar Orador | Coordenador, Editor, Administrador Global |
| UC-ORA-002 | Editar Orador | Coordenador, Editor, Administrador Global |
| UC-ORA-003 | Consultar Orador | Usuário |
| UC-ORA-004 | Registrar Temas Preparados | Coordenador, Editor |
| UC-ORA-005 | Atualizar Temas Preparados | Coordenador, Editor, Administrador Global |
| UC-ORA-006 | Consultar Histórico do Orador | Coordenador, Editor, Administrador Global |
| UC-ORA-007 | Vincular Conta ao Orador | Administrador Global, Coordenador |

---

## Catálogo

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-CAT-001 | Consultar Temas | Usuário |
| UC-CAT-002 | Consultar Categorias | Usuário |
| UC-CAT-003 | Cadastrar Tema | Administrador Global |
| UC-CAT-004 | Editar Tema | Administrador Global |
| UC-CAT-005 | Cadastrar Categoria | Administrador Global |
| UC-CAT-006 | Editar Categoria | Administrador Global |
| UC-CAT-007 | Importar Catálogo S-99 | Administrador Global |

---

## Programações

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-PRO-001 | Criar Programação | Coordenador, Editor |
| UC-PRO-002 | Editar Programação | Coordenador, Editor |
| UC-PRO-003 | Cancelar Programação | Coordenador, Editor |
| UC-PRO-004 | Consultar Agenda | Usuário |
| UC-PRO-005 | Consultar Calendário | Usuário |
| UC-PRO-006 | Confirmar Realização | Coordenador, Editor |

---

## Convites

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-CONV-001 | Criar Convite | Coordenador, Editor |
| UC-CONV-002 | Enviar Convite | Coordenador, Editor |
| UC-CONV-003 | Reenviar Convite | Coordenador, Editor |
| UC-CONV-004 | Cancelar Convite | Coordenador, Editor |
| UC-CONV-005 | Aceitar Convite | Orador |
| UC-CONV-006 | Recusar Convite | Orador |
| UC-CONV-007 | Confirmar Convite | Orador |

---

## Relatórios

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-REL-001 | Consultar Relatórios | Usuário |
| UC-REL-002 | Relatório de Programações | Usuário |
| UC-REL-003 | Relatório de Oradores | Usuário |
| UC-REL-004 | Relatório de Convites | Usuário |
| UC-REL-005 | Relatório de Histórico | Usuário |
| UC-REL-006 | Exportar Relatório | Usuário |

---

## Configurações

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-CONF-001 | Consultar Perfil | Usuário |
| UC-CONF-002 | Editar Perfil | Usuário |
| UC-CONF-003 | Alterar Preferências | Usuário |
| UC-CONF-004 | Consultar Configurações da Congregação | Coordenador, Editor, Leitor |

---

## Inteligência

| Código | Caso de Uso | Ator Principal |
|---------|-------------|----------------|
| UC-INT-001 | Sugerir Oradores | Coordenador, Editor |
| UC-INT-002 | Detectar Conflitos | Sistema |
| UC-INT-003 | Alertar Repetição de Tema | Sistema |
| UC-INT-004 | Exibir Pendências | Coordenador, Editor |
| UC-INT-005 | Exibir Dashboard | Usuário |
| UC-INT-006 | Exibir Indicadores | Coordenador, Editor, Administrador Global |
| UC-INT-007 | Exibir Estatísticas | Coordenador, Editor, Administrador Global |

---

# Relação entre Atores e Perfis

Os Casos de Uso não devem ser vinculados diretamente a um único perfil quando a funcionalidade puder ser executada por mais de um perfil.

A autorização será determinada pelas permissões atribuídas ao Perfil do Usuário.

### Administrador Global

Possui acesso às funções administrativas globais da plataforma.

Pode:

- administrar dados globais;
- administrar congregações;
- administrar usuários quando permitido;
- administrar perfis;
- administrar permissões;
- administrar temas e categorias.

---

### Coordenador

Possui permissões de coordenação dentro de sua Congregação.

Pode executar as operações atribuídas ao seu Perfil.

---

### Editor

Possui permissões operacionais de edição dentro de sua Congregação.

Pode criar e alterar informações para as quais tenha permissão.

---

### Leitor

Possui acesso somente para consulta às informações permitidas.

Não poderá executar operações que alterem dados.

---

# Regras Gerais dos Casos de Uso

Todos os Casos de Uso deverão respeitar:

- as Regras de Negócio do SIPD;
- as permissões do Perfil do Usuário;
- as restrições da Congregação do Usuário;
- as invariantes do Modelo de Domínio;
- as regras de segurança e auditoria.

---

# Relação com as Regras de Negócio

Cada Caso de Uso detalhado deverá informar as Regras de Negócio aplicáveis.

Exemplo:

```text
UC-PRO-001 — Criar Programação

Regras relacionadas:

- RN-050
- RN-051
- RN-052
- RN-053
- RN-093
```

---

# Relação com o Modelo de Domínio

Os Casos de Uso deverão utilizar exclusivamente os conceitos definidos no Modelo de Domínio e no Glossário Oficial.

As principais entidades envolvidas são:

- Usuário;
- Perfil;
- Congregação;
- Orador;
- Tema;
- Categoria;
- Tema Preparado;
- Programação;
- Convite;
- Confirmação;
- Histórico.

---

# Considerações Finais

Este documento apresenta o inventário dos Casos de Uso previstos para a primeira versão do SIPD.

Cada Caso de Uso será detalhado em documentos específicos, contendo:

- objetivo;
- atores;
- permissões;
- pré-condições;
- gatilho;
- fluxo principal;
- fluxos alternativos;
- fluxos de exceção;
- pós-condições;
- regras de negócio relacionadas;
- entidades envolvidas;
- APIs relacionadas;
- telas relacionadas.

Os Casos de Uso servirão como referência para os documentos de Fluxos, DER, Dicionário de Dados, Arquitetura, Permissões e API.

O Modelo de Domínio e as Regras de Negócio permanecem como referências superiores para a definição das funcionalidades.