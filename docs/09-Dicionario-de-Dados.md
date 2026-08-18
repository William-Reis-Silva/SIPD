# 09 — Dicionário de Dados

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.1

---

# Objetivo

Este documento define o Dicionário de Dados do Sistema Inteligente de Programação de Discursos (SIPD).

Seu objetivo é detalhar a estrutura de cada tabela apresentada no 08 — DER, especificando seus campos, tipos, chaves, restrições, regras de validação e finalidade.

Este documento deverá permanecer alinhado ao:

- Modelo de Domínio;
- Glossário;
- Regras de Negócio;
- Casos de Uso;
- Fluxos;
- DER.

O Dicionário de Dados representa a especificação detalhada dos dados persistidos pelo sistema.

---

# Convenções

## Identificadores

As entidades principais utilizam `UUID`.

Os identificadores deverão ser únicos e não depender de informações de negócio.

## Datas e Horários

Os campos de data e hora utilizam `TIMESTAMP`.

Os campos que representam somente uma data utilizam `DATE`.

## Campos de Situação

Campos `ativo` representam a situação de um registro.

Valores esperados:

- `true` — ativo
- `false` — inativo

A desativação de registros deverá ser preferida à exclusão quando houver necessidade de preservação histórica.

---

## 1. Estados

**Tabela:** `estados`

### Finalidade

Armazena os estados brasileiros utilizados para localização das congregações e dos oradores.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador único do estado |
| nome | VARCHAR | Sim | Não | Não | Sim | Nome oficial do estado |
| uf | CHAR(2) | Sim | Não | Não | Sim | Sigla oficial do estado |
| ativo | BOOLEAN | Sim | Não | Não | Não | Indica se o estado está ativo |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Restrições

- `id` é a chave primária.
- `nome` deverá ser único.
- `uf` deverá ser única.
- Estados inativos não deverão ser utilizados em novos cadastros.

---

## 2. Cidades

**Tabela:** `cidades`

### Finalidade

Armazena as cidades utilizadas pelo sistema.

Cada cidade pertence a um único estado.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador único da cidade |
| estado_id | UUID | Sim | Não | Sim | Não | Estado ao qual a cidade pertence |
| nome | VARCHAR | Sim | Não | Não | Não | Nome oficial da cidade |
| ativo | BOOLEAN | Sim | Não | Não | Não | Indica se a cidade está ativa |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chave estrangeira

`estado_id` → `estados.id`

### Restrição

A combinação `estado_id + nome` deverá ser única.

Isso permite que cidades com o mesmo nome existam em estados diferentes.

---

## 3. Congregações

**Tabela:** `congregacoes`

### Finalidade

Representa uma congregação cadastrada no SIPD.

Cada congregação está localizada em uma cidade.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador único da congregação |
| cidade_id | UUID | Sim | Não | Sim | Não | Cidade onde a congregação está localizada |
| nome | VARCHAR | Sim | Não | Não | Não | Nome da congregação |
| numero | VARCHAR | Sim | Não | Não | Sim | Número oficial de registro da congregação (RN-025) |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da congregação |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chave estrangeira

`cidade_id` → `cidades.id`

### Relacionamento

Uma cidade poderá possuir diversas congregações.

---

## 4. Perfis

**Tabela:** `perfis`

### Finalidade

Define o nível de acesso de um usuário no SIPD.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do perfil |
| nome | VARCHAR | Sim | Não | Não | Sim | Nome do perfil |
| descricao | TEXT | Não | Não | Não | Não | Descrição das responsabilidades e permissões |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação do perfil |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Perfis iniciais

- Administrador Global
- Coordenador
- Editor
- Leitor

---

## 5. Usuários

**Tabela:** `usuarios`

### Finalidade

Representa a conta de domínio do usuário que possui acesso ao SIPD.

A autenticação é realizada pelo mecanismo de autenticação definido para a aplicação.

Os dados relacionados ao domínio são mantidos nesta tabela.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do usuário |
| congregacao_id | UUID | Sim | Não | Sim | Não | Congregação administrada pelo usuário |
| perfil_id | UUID | Sim | Não | Sim | Não | Perfil de acesso do usuário |
| nome | VARCHAR | Sim | Não | Não | Não | Nome do usuário |
| sobrenome | VARCHAR | Sim | Não | Não | Não | Sobrenome do usuário |
| email | VARCHAR | Sim | Não | Não | Não definido no DER | E-mail utilizado pela conta |
| telefone | VARCHAR | Não | Não | Não | Não | Telefone do usuário (RN-026); uso futuro como chave de correspondência com Oradores |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da conta |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chaves estrangeiras

- `congregacao_id` → `congregacoes.id`
- `perfil_id` → `perfis.id`

### Relacionamentos

- Uma congregação possui vários usuários.
- Um perfil pode estar associado a vários usuários.
- Todo usuário pertence a uma congregação.
- Todo usuário possui um perfil.

---

## 6. Oradores

**Tabela:** `oradores`

### Finalidade

Representa uma pessoa apta a apresentar discursos públicos.

O cadastro do orador é global.

Um orador possui uma congregação de origem e uma cidade de residência.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do orador |
| congregacao_origem_id | UUID | Sim | Não | Sim | Não | Congregação de origem do orador |
| cidade_id | UUID | Sim | Não | Sim | Não | Cidade de residência do orador |
| usuario_id | UUID | Não | Não | Sim | Não definido no DER | Usuário associado após reivindicação |
| nome | VARCHAR | Sim | Não | Não | Não | Nome do orador |
| sobrenome | VARCHAR | Sim | Não | Não | Não | Sobrenome do orador |
| telefone_normalizado | VARCHAR | Sim | Não | Não | Sim | Número de telefone normalizado |
| email | VARCHAR | Não | Não | Não | Não definido no DER | E-mail do orador |
| perfil_reivindicado | BOOLEAN | Sim | Não | Não | Não | Indica se o orador reivindicou seu cadastro |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação do cadastro |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chaves estrangeiras

- `congregacao_origem_id` → `congregacoes.id`
- `cidade_id` → `cidades.id`
- `usuario_id` → `usuarios.id`

### Telefone

O banco armazenará somente o telefone normalizado.

Exemplo:

- Valor informado: `(11) 99999-1111`
- Valor armazenado: `5511999991111`

Não deverá existir uma segunda coluna contendo o telefone formatado.

### Regras

`telefone_normalizado` deverá possuir unicidade global.

O telefone será utilizado para:

- comparação;
- busca;
- identificação;
- reivindicação do cadastro;
- prevenção de duplicidade.

A aplicação será responsável por:

- receber o telefone;
- normalizar o valor;
- validar o número;
- armazenar o valor normalizado;
- formatar o valor para apresentação.

---

## 7. Categorias

**Tabela:** `categorias`

### Finalidade

Representa uma categoria da relação oficial de temas.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da categoria |
| nome | VARCHAR | Sim | Não | Não | Sim | Nome da categoria |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação da categoria |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Restrições

- `nome` deverá ser único.

---

## 8. Temas

**Tabela:** `temas`

### Finalidade

Representa um tema oficial da relação S-99.

Os temas pertencem à Base Global.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do tema |
| categoria_id | UUID | Sim | Não | Sim | Não | Categoria do tema |
| numero | VARCHAR | Sim | Não | Não | Sim | Número oficial do tema |
| titulo | VARCHAR | Sim | Não | Não | Não | Título oficial |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação do tema |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chave estrangeira

`categoria_id` → `categorias.id`

### Restrições

- `numero` deverá ser único.
- Todo tema deverá pertencer a uma categoria.

---

## 9. Temas Preparados

**Tabela:** `temas_preparados`

### Finalidade

Relaciona um orador a um tema que ele está preparado para apresentar.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do relacionamento |
| orador_id | UUID | Sim | Não | Sim | Não | Orador preparado |
| tema_id | UUID | Sim | Não | Sim | Não | Tema preparado |
| observacoes | TEXT | Não | Não | Não | Não | Informações adicionais |
| ativo | BOOLEAN | Sim | Não | Não | Não | Situação do preparo |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chaves estrangeiras

- `orador_id` → `oradores.id`
- `tema_id` → `temas.id`

### Restrição

A combinação `orador_id + tema_id` deverá ser única.

Um orador não poderá possuir o mesmo tema preparado duas vezes.

---

## 10. Programações

**Tabela:** `programacoes`

### Finalidade

Representa um discurso público agendado.

É uma das principais entidades operacionais do SIPD.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da programação |
| congregacao_id | UUID | Sim | Não | Sim | Não | Congregação da programação |
| tema_id | UUID | Sim | Não | Sim | Não | Tema programado |
| orador_id | UUID | Sim | Não | Sim | Não | Orador principal |
| data | DATE | Sim | Não | Não | Não | Data da programação |
| status | VARCHAR | Sim | Não | Não | Não | Situação da programação |
| observacoes | TEXT | Não | Não | Não | Não | Observações |
| criado_por | UUID | Sim | Não | Sim | Não | Usuário responsável pela criação |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chaves estrangeiras

- `congregacao_id` → `congregacoes.id`
- `tema_id` → `temas.id`
- `orador_id` → `oradores.id`
- `criado_por` → `usuarios.id`

### Restrição

A combinação `congregacao_id + data` deverá ser única.

Não poderá existir mais de uma programação para a mesma congregação na mesma data.

---

## 11. Convites

**Tabela:** `convites`

### Finalidade

Representa um convite enviado a um orador para determinada programação.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do convite |
| programacao_id | UUID | Sim | Não | Sim | Não | Programação relacionada |
| orador_id | UUID | Sim | Não | Sim | Não | Orador convidado |
| status | VARCHAR | Sim | Não | Não | Não | Estado atual do convite |
| enviado_em | TIMESTAMP | Não | Não | Não | Não | Data do envio |
| respondido_em | TIMESTAMP | Não | Não | Não | Não | Data da resposta |
| cancelado_em | TIMESTAMP | Não | Não | Não | Não | Data do cancelamento |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |
| atualizado_em | TIMESTAMP | Sim | Não | Não | Não | Data da última alteração |

### Chaves estrangeiras

- `programacao_id` → `programacoes.id`
- `orador_id` → `oradores.id`

### Estados

- Criado
- Enviado
- Aceito
- Recusado
- Cancelado
- Expirado

---

## 12. Confirmações

**Tabela:** `confirmacoes`

### Finalidade

Representa a confirmação enviada pelo orador após aceitar um convite.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da confirmação |
| convite_id | UUID | Sim | Não | Sim | Não definido no DER | Convite relacionado |
| cantico_inicial | VARCHAR | Não | Não | Não | Não | Cântico inicial |
| utilizara_imagens | BOOLEAN | Não | Não | Não | Não | Indica utilização de imagens |
| permanecera_ate_final | BOOLEAN | Não | Não | Não | Não | Confirmação de permanência até o final |
| observacoes | TEXT | Não | Não | Não | Não | Observações |
| enviada_em | TIMESTAMP | Não | Não | Não | Não | Data do envio |
| atualizada_em | TIMESTAMP | Não | Não | Não | Não | Data da última alteração |

### Chave estrangeira

`convite_id` → `convites.id`

### Regra

Uma confirmação pertence a um único convite.

**Observação:** o DER define a relação como um convite → uma confirmação, mas não especifica explicitamente uma restrição UNIQUE(convite_id). Essa decisão poderá ser formalizada na próxima revisão do DER, se desejarmos que o banco garanta essa cardinalidade.

---

## 13. Históricos

**Tabela:** `historicos`

### Finalidade

Registra acontecimentos importantes para histórico e auditoria.

Os registros históricos não deverão ser excluídos.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do registro histórico |
| programacao_id | UUID | Não | Não | Sim | Não | Programação relacionada ao evento |
| usuario_id | UUID | Não | Não | Sim | Não | Usuário responsável pela ação |
| tipo | VARCHAR | Sim | Não | Não | Não | Tipo do evento |
| descricao | TEXT | Sim | Não | Não | Não | Descrição do acontecimento |
| dados | JSONB | Não | Não | Não | Não | Dados complementares para auditoria |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data e hora do evento |

### Chaves estrangeiras

- `programacao_id` → `programacoes.id`
- `usuario_id` → `usuarios.id`

### Campo `dados`

O campo `dados` permite armazenar informações complementares relacionadas ao evento sem necessidade de alterar a estrutura da tabela a cada novo tipo de informação de auditoria.

---

## 14. Notificações

**Tabela:** `notificacoes`

### Finalidade

Representa mensagens apresentadas aos usuários.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador da notificação |
| usuario_id | UUID | Sim | Não | Sim | Não | Usuário destinatário |
| tipo | VARCHAR | Sim | Não | Não | Não | Tipo da notificação |
| titulo | VARCHAR | Sim | Não | Não | Não | Título da notificação |
| mensagem | TEXT | Sim | Não | Não | Não | Conteúdo da notificação |
| lida | BOOLEAN | Sim | Não | Não | Não | Indica se foi lida |
| lida_em | TIMESTAMP | Não | Não | Não | Não | Data em que foi lida |
| criada_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |

### Chave estrangeira

`usuario_id` → `usuarios.id`

---

## 15. Convites de Usuário

**Tabela:** `convites_usuario`

### Finalidade

Representa um convite de código/link para um usuário se vincular (ou se transferir) a uma congregação, com o perfil definido no convite.

| Coluna | Tipo | Obrigatório | PK | FK | Unique | Descrição |
|--------|------|--------------|----|----|--------|-----------|
| id | UUID | Sim | Sim | Não | Sim | Identificador do convite |
| congregacao_id | UUID | Sim | Não | Sim | Não | Congregação de destino |
| perfil_id | UUID | Sim | Não | Sim | Não | Perfil atribuído ao aceitar |
| codigo | VARCHAR | Sim | Não | Não | Sim | Código de 8 caracteres compartilhado manualmente |
| rotulo | VARCHAR | Não | Não | Não | Não | Anotação livre de quem convidou |
| status | VARCHAR | Sim | Não | Não | Não | Estado atual do convite |
| criado_por | UUID | Sim | Não | Sim | Não | Usuário que criou o convite |
| expira_em | TIMESTAMP | Sim | Não | Não | Não | Validade do convite (7 dias após criação) |
| aceito_por | UUID | Não | Não | Sim | Não | Usuário que aceitou o convite |
| aceito_em | TIMESTAMP | Não | Não | Não | Não | Data da aceitação |
| cancelado_em | TIMESTAMP | Não | Não | Não | Não | Data do cancelamento |
| criado_em | TIMESTAMP | Sim | Não | Não | Não | Data de criação |

### Chaves estrangeiras

- `congregacao_id` → `congregacoes.id`
- `perfil_id` → `perfis.id`
- `criado_por` → `usuarios.id`
- `aceito_por` → `usuarios.id`

### Estados

- Pendente
- Aceito
- Cancelado
- Expirado

---

# Índices e Restrições de Unicidade

As principais restrições de unicidade previstas no DER são:

| Tabela | Restrição |
|--------|-----------|
| estados | nome |
| estados | uf |
| cidades | estado_id + nome |
| congregacoes | numero |
| oradores | telefone_normalizado |
| temas | numero |
| temas_preparados | orador_id + tema_id |
| programacoes | congregacao_id + data |

Essas restrições deverão ser implementadas diretamente no banco de dados.

---

# Resumo dos Relacionamentos

| Origem | Cardinalidade | Destino |
|--------|----------------|---------|
| Estado | 1:N | Cidades |
| Cidade | 1:N | Congregações |
| Cidade | 1:N | Oradores |
| Congregação | 1:N | Usuários |
| Perfil | 1:N | Usuários |
| Congregação | 1:N | Oradores |
| Categoria | 1:N | Temas |
| Orador | N:N | Temas, através de temas_preparados |
| Congregação | 1:N | Programações |
| Tema | 1:N | Programações |
| Orador | 1:N | Programações |
| Programação | 1:N | Convites |
| Orador | 1:N | Convites |
| Convite | 1:1* | Confirmações |
| Programação | 1:N | Históricos |
| Usuário | 1:N | Históricos |
| Usuário | 1:N | Notificações |

\* A relação de uma confirmação por convite é definida conceitualmente no DER, mas a restrição física de unicidade em `convite_id` ainda precisa ser formalizada.

---

# Dados Globais e Dados Locais

## Dados Globais

São compartilhados entre as congregações:

- Estados
- Cidades
- Oradores
- Temas
- Categorias

## Dados Locais

Relacionados à operação das congregações:

- Usuários
- Programações
- Convites
- Confirmações
- Notificações
- Histórico operacional

Um Orador permanece global mesmo quando recebe convites de diferentes congregações.

---

# Localização

A estrutura de localização utiliza:

```text
Estado
   ↓
Cidade
   ↓
Congregação
```

e:

```text
Estado
   ↓
Cidade
   ↓
Orador
```

A cidade de residência do Orador não precisa ser a mesma cidade da Congregação de Origem.

Essa estrutura permitirá futuramente utilizar informações geográficas para apoiar a seleção de Oradores.

---

# Telefone do Orador

O sistema utilizará uma única representação persistida do telefone: `telefone_normalizado`.

Exemplo:

```text
Entrada:  (11) 99999-1111
              ↓
        Normalização
              ↓
Banco:    5511999991111
```

Não será armazenado um segundo campo para o telefone formatado.

A formatação será responsabilidade da aplicação.

---

# Observações de Implementação

O presente documento descreve a estrutura lógica dos dados conforme definida no 08 — DER.

Detalhes específicos de implementação, como:

- tamanho exato de VARCHAR;
- índices auxiliares;
- valores padrão;
- estratégia de geração de UUID;
- comportamento ON DELETE;
- comportamento ON UPDATE;
- políticas de segurança;
- Row Level Security;
- mecanismos específicos de autenticação;

deverão ser definidos na documentação técnica correspondente, sem alterar silenciosamente o modelo conceitual.

---

# Rastreabilidade

O Dicionário de Dados deverá permanecer alinhado aos seguintes documentos:

- 02 - Glossário
- 04 - Regras de Negócio
- 05 - Modelo de Domínio
- 05.1 - Domain Map
- 05.2 - Mapa Funcional
- 06 - Casos de Uso
- 06.1 - Especificação dos Casos de Uso
- 07 - Fluxos
- 08 - DER

---

# Considerações Finais

O 09 — Dicionário de Dados complementa o 08 — DER.

O DER apresenta quais entidades existem e como elas se relacionam.

O Dicionário de Dados apresenta o significado e as características de cada campo persistido.

Qualquer alteração estrutural no banco deverá ser refletida simultaneamente no DER e neste documento, preservando a rastreabilidade da arquitetura do SIPD.
