# 08 - DER

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.4

---

# Objetivo

Este documento define o Diagrama Entidade-Relacionamento (DER) do Sistema Inteligente de Programação de Discursos (SIPD).

O DER apresenta as entidades persistentes do sistema, seus principais atributos, relacionamentos, chaves e restrições de integridade.

Este documento representa a estrutura lógica do banco de dados e deverá permanecer alinhado ao Modelo de Domínio, às Regras de Negócio, aos Casos de Uso e ao Dicionário de Dados.

---

# Princípios de Modelagem

A modelagem do banco de dados deverá seguir os seguintes princípios:

- utilizar identificadores UUID para as entidades principais;
- utilizar chaves estrangeiras para representar relacionamentos;
- evitar duplicação de informações;
- manter uma única fonte de verdade para cada dado;
- utilizar tabelas de domínio para informações compartilhadas;
- utilizar valores normalizados para dados utilizados em comparação;
- preservar registros necessários para histórico e auditoria;
- aplicar restrições de integridade diretamente no banco de dados;
- manter separadas informações globais e informações específicas da congregação.

---

# Entidades

O banco de dados do SIPD será composto inicialmente pelas seguintes entidades:

- estados
- cidades
- congregacoes
- perfis
- usuarios
- oradores
- categorias
- temas
- temas_preparados
- programacoes
- convites
- confirmacoes
- historicos
- notificacoes

---

## 1. Estados

Representa os estados brasileiros utilizados para localização das congregações e dos oradores.

**Tabela:** `estados`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| nome | VARCHAR | Nome oficial do estado |
| uf | CHAR(2) | Sigla oficial |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrições

- `uf` deverá ser única.
- `nome` deverá ser único.
- Estados inativos não deverão ser utilizados em novos cadastros.

---

## 2. Cidades

Representa as cidades utilizadas pelo sistema.

Uma cidade pertence a um único estado.

**Tabela:** `cidades`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| estado_id | UUID | FK → estados |
| nome | VARCHAR | Nome oficial |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrições

A combinação `estado_id + nome` deverá ser única.

Isso permite que cidades com o mesmo nome existam em estados diferentes sem gerar conflito.

---

## 3. Congregações

Representa uma congregação cadastrada no SIPD.

Cada congregação está localizada em uma cidade.

**Tabela:** `congregacoes`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| cidade_id | UUID | FK → cidades |
| nome | VARCHAR | Nome da congregação |
| numero | VARCHAR | Número oficial de registro, único |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrições

- `numero` deverá ser único (RN-025).

### Relacionamentos

```text
Congregação
    │
    └── pertence a uma Cidade
```

Uma cidade poderá possuir diversas congregações.

---

## 4. Perfis

Define o nível de acesso de um usuário.

**Tabela:** `perfis`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| nome | VARCHAR | Nome do perfil |
| descricao | TEXT | Descrição |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Perfis iniciais

- Administrador Global
- Coordenador
- Editor
- Leitor

---

## 5. Usuários

Representa a conta autenticada que possui acesso ao SIPD.

A autenticação será realizada pelo mecanismo de autenticação definido para a aplicação, enquanto os dados de domínio serão mantidos na tabela `usuarios`.

**Tabela:** `usuarios`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_id | UUID | FK → congregacoes |
| perfil_id | UUID | FK → perfis |
| nome | VARCHAR | Nome |
| sobrenome | VARCHAR | Sobrenome |
| email | VARCHAR | E-mail da conta |
| telefone | VARCHAR | Opcional |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Relacionamentos

- Congregação 1 ───── N Usuários
- Perfil 1 ───── N Usuários

---

## 6. Oradores

Representa uma pessoa apta a apresentar discursos públicos.

O cadastro do Orador é global.

Cada Orador possui uma única Congregação de Origem, mas poderá receber convites de qualquer congregação.

O Orador também possui uma cidade de residência, que pode ser diferente da cidade da sua Congregação de Origem.

**Tabela:** `oradores`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_origem_id | UUID | FK → congregacoes |
| cidade_id | UUID | FK → cidades |
| usuario_id | UUID | FK → usuarios, pode ser NULL |
| nome | VARCHAR | Nome |
| sobrenome | VARCHAR | Sobrenome |
| telefone_normalizado | VARCHAR | Número normalizado |
| email | VARCHAR | Pode ser NULL |
| perfil_reivindicado | BOOLEAN | Indica se o cadastro foi reivindicado |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Telefone do Orador

O banco armazenará somente o telefone normalizado.

Exemplo:

- Valor informado: `(11) 99999-1111`
- Valor armazenado: `5511999991111`

A aplicação será responsável por:

- normalizar o telefone recebido;
- validar o número;
- armazenar somente o valor normalizado;
- formatar o número para apresentação ao usuário.

O telefone normalizado será utilizado para:

- comparação;
- busca;
- identificação;
- reivindicação de cadastro;
- prevenção de duplicidade.

### Restrição

`telefone_normalizado` deverá possuir índice de unicidade.

```text
UNIQUE (telefone_normalizado)
```

A unicidade será global.

---

## 7. Categorias

Representa uma categoria da relação oficial de temas.

**Tabela:** `categorias`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| nome | VARCHAR | Nome da categoria |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

---

## 8. Temas

Representa um tema oficial da relação S-99.

Os temas pertencem à Base Global do sistema.

**Tabela:** `temas`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| categoria_id | UUID | FK → categorias |
| numero | VARCHAR | Número oficial |
| titulo | VARCHAR | Título oficial |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrições

`numero` deverá ser único.

---

## 9. Temas Preparados

Representa o relacionamento entre um Orador e um Tema.

Indica que determinado Orador está preparado para apresentar determinado tema.

**Tabela:** `temas_preparados`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| orador_id | UUID | FK → oradores |
| tema_id | UUID | FK → temas |
| observacoes | TEXT | Informações adicionais |
| ativo | BOOLEAN | Situação |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrição

Um Orador não poderá possuir o mesmo Tema Preparado duas vezes.

```text
UNIQUE (orador_id, tema_id)
```

---

## 10. Programações

Representa um discurso público agendado.

É uma das principais entidades do SIPD.

**Tabela:** `programacoes`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_id | UUID | FK → congregacoes |
| tema_id | UUID | FK → temas |
| orador_id | UUID | FK → oradores |
| data | DATE | Data da programação |
| status | VARCHAR | Status |
| observacoes | TEXT | Observações |
| criado_por | UUID | FK → usuarios |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Restrição

Não poderá existir mais de uma programação para a mesma congregação na mesma data.

```text
UNIQUE (congregacao_id, data)
```

---

## 11. Convites

Representa um convite enviado a um Orador, oferecendo datas candidatas de uma Congregação. Não depende de uma Programação pré-existente — a Programação só é criada quando o Orador aceita.

**Tabela:** `convites`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| congregacao_id | UUID | FK → congregacoes |
| programacao_id | UUID | FK → programacoes, nulo até o Orador aceitar |
| orador_id | UUID | FK → oradores |
| status | VARCHAR | Estado do convite |
| token | UUID | Identifica o link público de resposta (`/convite/{token}`) |
| expira_em | TIMESTAMP | Validade do link (7 dias da criação, renovada ao reenviar) |
| enviado_em | TIMESTAMP | Data do envio |
| respondido_em | TIMESTAMP | Data da resposta |
| cancelado_em | TIMESTAMP | Data do cancelamento |
| criado_por | UUID | FK → usuarios, quem criou o convite |
| criado_em | TIMESTAMP | Data de criação |
| atualizado_em | TIMESTAMP | Última alteração |

### Estados

- Criado
- Enviado
- Aceito
- Recusado
- Cancelado
- Expirado

---

## 11.1 Datas Candidatas do Convite

Representa uma data oferecida ao Orador dentro de um Convite. Uma data não pode ser oferecida por dois convites simultaneamente abertos (`Criado`/`Enviado`) da mesma congregação.

**Tabela:** `convite_datas`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| convite_id | UUID | FK → convites |
| data | DATE | Data candidata |
| criado_em | TIMESTAMP | Data de criação |

### Restrição

```text
UNIQUE (convite_id, data)
```

---

## 12. Confirmações

Representa a confirmação enviada pelo Orador após aceitar um convite.

**Tabela:** `confirmacoes`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| convite_id | UUID | FK → convites |
| cantico_inicial | VARCHAR | Cântico inicial |
| utilizara_imagens | BOOLEAN | Utilização de imagens |
| permanecera_ate_final | BOOLEAN | Confirmação de permanência |
| observacoes | TEXT | Observações |
| anexos | JSONB | Lista de arquivos anexados (`[{ "caminho", "nome_arquivo" }]`) |
| enviada_em | TIMESTAMP | Data do envio |
| atualizada_em | TIMESTAMP | Última alteração |

Uma confirmação pertence a um único convite.

---

## 13. Históricos

Registra acontecimentos importantes para fins de histórico e auditoria.

O histórico não deverá ser excluído.

**Tabela:** `historicos`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| programacao_id | UUID | FK → programacoes, pode ser NULL |
| usuario_id | UUID | FK → usuarios, pode ser NULL |
| tipo | VARCHAR | Tipo do evento |
| descricao | TEXT | Descrição |
| dados | JSONB | Dados complementares |
| criado_em | TIMESTAMP | Data do evento |

O campo `dados` permitirá armazenar informações complementares necessárias para auditoria sem alterar constantemente a estrutura da tabela.

---

## 14. Notificações

Representa mensagens apresentadas aos usuários.

**Tabela:** `notificacoes`

| Coluna | Tipo | Regra |
|--------|------|-------|
| id | UUID | PK |
| usuario_id | UUID | FK → usuarios |
| tipo | VARCHAR | Tipo da notificação |
| titulo | VARCHAR | Título |
| mensagem | TEXT | Conteúdo |
| lida | BOOLEAN | Controle de leitura |
| lida_em | TIMESTAMP | Data da leitura |
| criada_em | TIMESTAMP | Data de criação |

---

# Relacionamentos Principais

## Localização

```text
ESTADOS
   │
   └── N CIDADES
          │
          ├── N CONGREGAÇÕES
          │
          └── N ORADORES
```

Uma cidade pertence a um Estado.

Uma Congregação pertence a uma Cidade.

Um Orador possui uma Cidade de residência.

A cidade do Orador não precisa ser a mesma cidade da sua Congregação de Origem.

## Administração

```text
CONGREGAÇÃO
     │
     └── N USUÁRIOS
              │
              └── 1 PERFIL
```

## Oradores e Temas

```text
ORADOR
   │
   └── N TEMAS_PREPARADOS
              │
              └── 1 TEMA
```

Um Tema poderá estar preparado por diversos Oradores.

## Programação

```text
CONGREGAÇÃO
      │
      └── N PROGRAMAÇÕES
                │
                ├── 1 TEMA
                │
                ├── 1 ORADOR
                │
                ├── N CONVITES
                │
                └── N HISTÓRICOS
```

## Convite

```text
PROGRAMAÇÃO
     │
     └── N CONVITES
             │
             ├── 1 ORADOR
             │
             └── 1 CONFIRMAÇÃO
```

---

# Diagrama Conceitual

```text
┌─────────────┐
│   ESTADOS   │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐
│   CIDADES   │
└──────┬──────┘
       │
       ├──────────────────┐
       │                  │
       │ 1:N              │ 1:N
       ▼                  ▼
┌──────────────┐    ┌──────────────┐
│ CONGREGAÇÕES │    │   ORADORES   │
└──────┬───────┘    └──────┬───────┘
       │                   │
       │ 1:N               │ 1:N
       ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│   USUÁRIOS   │    │ TEMAS_PREPARADOS │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       │ N:1                 │ N:1
       ▼                     ▼
┌──────────────┐       ┌──────────────┐
│   PERFIS     │       │    TEMAS     │
└──────────────┘       └──────┬───────┘
                              │
                              │ N:1
                              ▼
                       ┌──────────────┐
                       │  CATEGORIAS  │
                       └──────────────┘


┌──────────────┐
│ PROGRAMAÇÕES │
└──────┬───────┘
       │
       ├───────────────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│   CONVITES   │ │  HISTÓRICOS  │
└──────┬───────┘ └──────────────┘
       │
       ▼
┌──────────────┐
│ CONFIRMAÇÕES │
└──────────────┘


┌───────────────┐
│ NOTIFICAÇÕES  │
└───────┬───────┘
        │
        ▼
     USUÁRIOS
```

---

# Regras de Integridade Principais

O banco deverá garantir, sempre que aplicável, as seguintes restrições:

## Congregação

- Toda Congregação pertence a uma Cidade.
- Toda Cidade pertence a um Estado.
- O nome da Congregação deverá ser informado.

## Usuário

- Todo Usuário deverá estar vinculado a uma Congregação.
- Todo Usuário deverá possuir um Perfil.

## Orador

- Todo Orador possui uma Congregação de Origem.
- Todo Orador possui uma Cidade.
- O telefone normalizado deverá ser único.
- Um Orador poderá ou não possuir uma conta de Usuário.
- Um Orador poderá reivindicar seu cadastro posteriormente.

## Tema

- Todo Tema possui um número oficial.
- O número do Tema deverá ser único.
- Todo Tema pertence a uma Categoria.

## Tema Preparado

- Um Orador poderá possuir diversos Temas Preparados.
- O mesmo Tema não poderá ser associado duas vezes ao mesmo Orador.

## Programação

- Toda Programação pertence a uma Congregação.
- Toda Programação possui um Tema.
- Toda Programação possui um Orador.
- Não poderá existir duplicidade de Programação para a mesma Congregação na mesma data.

## Convite

- Todo Convite pertence a uma Programação.
- Todo Convite pertence a um Orador.

## Confirmação

- Toda Confirmação pertence a um Convite.

## Histórico

- Registros históricos não deverão ser excluídos.

---

# Localização e Inteligência

A estrutura de localização foi projetada para permitir futuras funcionalidades de inteligência.

A relação:

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

permitirá ao sistema identificar a localização dos participantes.

Em uma versão futura, a tabela `cidades` poderá receber informações geográficas, como:

- latitude
- longitude

Com isso, o Motor de Inteligência poderá calcular distâncias entre a Congregação e os Oradores.

Exemplo conceitual:

```text
Tema selecionado
       ↓
Oradores preparados
       ↓
Cálculo de proximidade
       ↓
Ordenação
       ↓
Orador mais próximo
       ↓
Orador mais distante
```

A localização deverá ser utilizada como critério de apoio, não como única regra para escolha de um Orador.

---

# Normalização de Telefone

O banco armazenará somente o telefone normalizado.

Exemplo:

```text
Entrada:        (11) 99999-1111
                       ↓
                 Normalização
                       ↓
Banco de Dados: 5511999991111
```

A aplicação será responsável pela apresentação formatada.

Não será mantida uma segunda coluna contendo o telefone formatado.

Isso evita duplicidade e inconsistência de dados.

---

# Separação entre Dados Globais e Dados Locais

## Dados Globais

Compartilhados entre as congregações:

- Estados
- Cidades
- Oradores
- Temas
- Categorias

## Dados Locais

Relacionados à operação da Congregação:

- Usuários
- Programações
- Convites
- Confirmações
- Notificações
- Histórico operacional

Um Orador permanece global mesmo quando recebe convites de diferentes Congregações.

---

# Segurança

As relações entre usuários, congregações e demais entidades deverão respeitar as permissões definidas no sistema.

O banco deverá aplicar mecanismos de segurança para impedir acesso ou alteração indevida de dados.

As políticas de acesso deverão considerar:

- Congregação do usuário;
- Perfil do usuário;
- Permissões atribuídas;
- natureza global ou local da informação.

---

# Considerações sobre o DER

O DER representa a estrutura lógica inicial do banco de dados do SIPD.

Alterações futuras deverão ser avaliadas em conjunto com:

- Modelo de Domínio;
- Regras de Negócio;
- Glossário;
- Casos de Uso;
- Fluxos;
- Dicionário de Dados.

Nenhuma alteração estrutural relevante deverá ser realizada isoladamente.

---

# Próximo Documento

O documento seguinte deverá ser:

`09 - Dicionário de Dados.md`

O Dicionário de Dados deverá detalhar cada coluna apresentada neste DER, incluindo:

- nome;
- tipo;
- tamanho;
- obrigatoriedade;
- valor padrão;
- chave primária;
- chave estrangeira;
- índice;
- unicidade;
- descrição;
- regras de validação;
- relacionamento;
- observações de implementação.

Assim, o 08 - DER fica como a visão estrutural do banco, enquanto o 09 - Dicionário de Dados será a especificação detalhada de cada campo.
