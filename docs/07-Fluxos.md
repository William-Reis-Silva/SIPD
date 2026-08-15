# 07 - Fluxos

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.1

---

# Objetivo

Este documento descreve os principais fluxos de negócio do Sistema Inteligente de Programação de Discursos (SIPD).

Os fluxos representam a sequência de ações realizadas pelos usuários e pelo sistema para executar os processos definidos nos Casos de Uso.

Este documento complementa:

- 05 - Modelo de Domínio
- 05.1 - Domain Map
- 05.2 - Mapa Funcional
- 06 - Casos de Uso
- 06.1 - Especificação dos Casos de Uso

---

# Escopo

Os fluxos descritos neste documento representam os principais processos previstos para a versão 1.0 do SIPD.

O foco deste documento é descrever o processo de negócio, e não os detalhes da interface ou da implementação técnica.

---

# Convenções

Todos os fluxos serão identificados pelo seguinte padrão:

```text
FL-XXX-NNN
```

Onde:

- **FL** = Fluxo;
- **XXX** = módulo;
- **NNN** = sequência numérica.

Exemplo:

```text
FL-PRO-001
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

# Visão Geral do Processo Principal

O processo central do SIPD é a programação de um discurso.

```text
Programação
     ↓
Seleção do Tema
     ↓
Sugestão / Seleção do Orador
     ↓
Validação de Conflitos
     ↓
Envio do Convite
     ↓
┌───────────────┐
│               │
Aceito        Recusado
│               │
↓               ↓
Confirmação   Substituição
│               │
↓               └──────→ Novo Convite
Programação Confirmada
     ↓
Realização
     ↓
Histórico
```

---

# Administração

## FL-ADM-001 — Autenticação

### Objetivo

Representar o processo de entrada do usuário no sistema.

### Fluxo

```text
Usuário
   ↓
Acessa Login
   ↓
Informa e-mail e senha
   ↓
Sistema valida credenciais
   ↓
┌───────────────────┐
│                   │
Válidas           Inválidas
│                   │
↓                   ↓
Criar sessão      Informar erro
│
↓
Identificar perfil
│
↓
Carregar Dashboard
```

### Resultado

O usuário autenticado passa a ter acesso às funcionalidades permitidas pelo seu perfil.

### Casos de Uso Relacionados

- UC-ADM-001
- UC-ADM-004

---

## FL-ADM-002 — Recuperação de Senha

```text
Usuário
   ↓
Seleciona "Esqueci minha senha"
   ↓
Informa e-mail
   ↓
Sistema processa solicitação
   ↓
Envia link de recuperação
   ↓
Usuário acessa link
   ↓
Define nova senha
   ↓
Sistema confirma alteração
```

### Casos de Uso Relacionados

- UC-ADM-002
- UC-ADM-003

---

# Congregações

## FL-CGR-001 — Administração da Congregação

```text
Usuário autorizado
        ↓
Acessa Congregação
        ↓
Sistema identifica congregação
        ↓
Verifica permissão
        ↓
Apresenta dados permitidos
        ↓
Usuário consulta ou altera
        ↓
Sistema valida operação
        ↓
Salva alteração
        ↓
Registra Histórico quando aplicável
```

### Resultado

Os dados da congregação são mantidos de acordo com as permissões do usuário.

### Casos de Uso Relacionados

- Casos de Uso de Congregações

---

## FL-CGR-002 — Gerenciamento de Usuários da Congregação

```text
Coordenador
     ↓
Acessa Usuários
     ↓
Consulta usuários
     ↓
Convida / edita / ativa / desativa
     ↓
Sistema valida permissão
     ↓
Executa operação
     ↓
Atualiza dados
```

### Regra

O usuário não poderá administrar usuários de outra congregação, salvo operações permitidas especificamente ao Administrador Global.

---

# Oradores

## FL-ORA-001 — Cadastro de Orador

```text
Usuário autorizado
        ↓
Cadastrar Orador
        ↓
Informar dados
        ↓
Selecionar Congregação de Origem
        ↓
Sistema valida dados
        ↓
Verifica duplicidade
        ↓
Cadastrar Orador
        ↓
Disponibilizar na Base Global
```

### Resultado

O Orador passa a fazer parte da Base Global.

---

## FL-ORA-002 — Cadastro de Tema Preparado

```text
Orador
   ↓
Seleciona Tema
   ↓
Sistema verifica existência do Tema
   ↓
Verifica se já está preparado
   ↓
Registra Tema Preparado
   ↓
Atualiza disponibilidade do Orador
```

### Regra

Um Orador não poderá possuir o mesmo Tema Preparado duas vezes.

---

## FL-ORA-003 — Vínculo de Conta ao Orador

```text
Orador cadastrado
       ↓
Possui ou cria conta
       ↓
Solicita vínculo
       ↓
Sistema valida identidade
       ↓
Vínculo aprovado
       ↓
Conta associada ao Orador
       ↓
Orador passa a responder Convites
```

### Observação

O Orador pode existir no sistema sem possuir uma conta de usuário.

---

# Catálogo

## FL-CAT-001 — Consulta de Temas

```text
Usuário
   ↓
Seleciona Tema
   ↓
Sistema consulta Base Global
   ↓
Apresenta Tema
   ↓
Apresenta Categoria
```

### Resultado

O usuário obtém as informações oficiais do Tema.

---

# Programações

## FL-PRO-001 — Criar Programação

Este é um dos principais fluxos do SIPD.

```text
Usuário
   ↓
Nova Programação
   ↓
Define data
   ↓
Seleciona Tema
   ↓
Sistema verifica Tema
   ↓
Sistema verifica repetição
   ↓
Sugere Oradores
   ↓
Usuário seleciona Orador
   ↓
Sistema verifica conflitos
   ↓
┌───────────────────────┐
│                       │
Sem conflito          Conflito
│                       │
↓                       ↓
Continuar             Alertar usuário
│                       │
↓                       ↓
Criar Programação    Corrigir seleção
   ↓
Programação criada
```

### Resultado

Uma nova Programação é registrada.

---

## FL-PRO-002 — Programação → Convite

```text
Programação criada
       ↓
Orador definido
       ↓
Sistema prepara Convite
       ↓
Usuário confirma envio
       ↓
Convite enviado
       ↓
Aguardar resposta
```

### Resultado

A Programação passa a aguardar a resposta do Orador.

---

## FL-PRO-003 — Alterar Programação

```text
Programação existente
        ↓
Usuário seleciona Editar
        ↓
Altera dados
        ↓
Sistema executa validações
        ↓
Verifica conflitos
        ↓
┌─────────────────┐
│                 │
Válida          Inválida
│                 │
↓                 ↓
Salvar          Informar erro
│
↓
Atualizar Histórico
```

---

## FL-PRO-004 — Realização da Programação

```text
Programação Confirmada
        ↓
Data da programação
        ↓
Discurso realizado
        ↓
Usuário confirma realização
        ↓
Sistema registra realização
        ↓
Atualiza status
        ↓
Registra Histórico
        ↓
Arquivamento histórico
```

---

# Convites

## FL-CONV-001 — Envio de Convite

```text
Programação
     ↓
Orador definido
     ↓
Criar Convite
     ↓
Enviar Convite
     ↓
Notificar Orador
     ↓
Aguardar resposta
```

### Estado

```text
Criado
  ↓
Enviado
```

---

## FL-CONV-002 — Aceitação do Convite

```text
Convite Enviado
       ↓
Orador recebe Convite
       ↓
Visualiza informações
       ↓
Aceita
       ↓
Sistema registra aceite
       ↓
Solicita Confirmação
       ↓
Orador envia confirmação
       ↓
Programação Confirmada
```

---

## FL-CONV-003 — Recusa do Convite

```text
Convite Enviado
       ↓
Orador recebe Convite
       ↓
Recusa
       ↓
Sistema registra recusa
       ↓
Atualiza Histórico
       ↓
Programação fica sem Orador confirmado
       ↓
Sistema pode sugerir substitutos
```

---

## FL-CONV-004 — Substituição de Orador

```text
Convite recusado
       ↓
Sistema identifica necessidade
       ↓
Sugere Oradores
       ↓
Usuário seleciona substituto
       ↓
Sistema verifica conflitos
       ↓
Novo Convite
       ↓
Aguardar resposta
```

### Observação

O processo poderá se repetir até que exista um Orador confirmado ou o usuário decida cancelar ou alterar a Programação.

---

# Confirmações

## FL-CONV-005 — Confirmação da Apresentação

```text
Convite Aceito
      ↓
Formulário de Confirmação
      ↓
Orador informa dados
      ↓
Cânticos
      ↓
Imagens
      ↓
Arquivos
      ↓
Observações
      ↓
Confirmação de permanência
      ↓
Enviar
      ↓
Sistema valida
      ↓
Registra Confirmação
      ↓
Programação Confirmada
```

---

# Relatórios

## FL-REL-001 — Geração de Relatório

```text
Usuário
   ↓
Seleciona Relatório
   ↓
Define filtros
   ↓
Sistema verifica permissões
   ↓
Consulta dados
   ↓
Processa informações
   ↓
Apresenta resultados
```

---

## FL-REL-002 — Exportação

```text
Relatório gerado
       ↓
Selecionar Exportar
       ↓
Selecionar formato
       ↓
Sistema gera arquivo
       ↓
Arquivo disponibilizado
```

### Regra

A exportação não altera os dados de origem.

---

# Configurações

## FL-CONF-001 — Atualização do Perfil

```text
Usuário
   ↓
Acessa Perfil
   ↓
Seleciona Editar
   ↓
Altera dados permitidos
   ↓
Sistema valida
   ↓
Salva
   ↓
Atualiza Perfil
```

---

## FL-CONF-002 — Preferências

```text
Usuário
   ↓
Acessa Preferências
   ↓
Altera configuração
   ↓
Salva
   ↓
Sistema valida
   ↓
Atualiza Preferências
```

---

# Inteligência

## FL-INT-001 — Sugestão de Oradores

```text
Tema selecionado
      ↓
Sistema consulta Temas Preparados
      ↓
Identifica Oradores compatíveis
      ↓
Analisa dados disponíveis
      ↓
Verifica conflitos
      ↓
Ordena candidatos
      ↓
Apresenta sugestões
      ↓
Usuário escolhe
```

### Observação

A Inteligência sugere. A decisão final permanece com o usuário autorizado.

---

## FL-INT-002 — Detecção de Conflitos

```text
Dados da Programação
        ↓
Executar validações
        ↓
Verificar data
        ↓
Verificar Congregação
        ↓
Verificar Orador
        ↓
Verificar Programações
        ↓
Verificar regras
        ↓
┌─────────────────┐
│                 │
Sem conflito    Conflito
│                 │
↓                 ↓
Continuar       Alertar/Bloquear
```

---

## FL-INT-003 — Alertas de Repetição

```text
Tema selecionado
       ↓
Consultar Histórico
       ↓
Consultar Programações futuras
       ↓
Analisar utilização
       ↓
┌──────────────────┐
│                  │
Sem alerta       Alerta
│                  │
↓                  ↓
Continuar        Informar usuário
```

---

## FL-INT-004 — Pendências

```text
Sistema
   ↓
Consultar Programações
   ↓
Consultar Convites
   ↓
Consultar Confirmações
   ↓
Consultar conflitos
   ↓
Identificar situações pendentes
   ↓
Classificar
   ↓
Apresentar no Dashboard
```

---

# Fluxo Principal Completo do SIPD

O fluxo abaixo representa o processo operacional completo desde a criação da Programação até sua realização.

```text
                    INÍCIO
                       │
                       ↓
              Criar Programação
                       │
                       ↓
                 Selecionar Tema
                       │
                       ↓
              Verificar Repetição
                       │
                       ↓
              Sugerir Oradores
                       │
                       ↓
               Selecionar Orador
                       │
                       ↓
              Detectar Conflitos
                       │
              ┌────────┴────────┐
              │                 │
           Conflito          Sem conflito
              │                 │
              ↓                 ↓
       Corrigir dados      Criar Programação
                                │
                                ↓
                         Enviar Convite
                                │
                                ↓
                         Aguardar resposta
                                │
                    ┌───────────┴───────────┐
                    │                       │
                  Aceita                 Recusa
                    │                       │
                    ↓                       ↓
              Confirmação             Sugerir substituto
                    │                       │
                    ↓                       ↓
          Programação Confirmada     Novo Convite
                    │                       │
                    ↓                       └───────┐
             Realização                            │
                    │                              │
                    ↓                              │
               Histórico                           │
                    │                              │
                    ↓                              │
                 ARQUIVO                           │
                                                   │
                                                   └──→ Aguardar resposta
```

---

# Fluxo de Cancelamento

## FL-PRO-005 — Cancelar Programação

```text
Programação existente
        ↓
Usuário autorizado solicita cancelamento
        ↓
Sistema verifica permissões
        ↓
Confirmação do cancelamento
        ↓
Cancelar Convites relacionados
        ↓
Atualizar Programação
        ↓
Registrar Histórico
        ↓
Notificar envolvidos quando aplicável
```

### Resultado

A Programação deixa de estar disponível para realização e permanece registrada para fins históricos.

---

# Fluxo de Auditoria

## FL-INT-005 — Registro de Eventos

Ações relevantes do sistema deverão produzir registros históricos.

```text
Ação relevante
      ↓
Sistema identifica operação
      ↓
Executa operação
      ↓
Registra Evento
      ↓
Registra usuário responsável
      ↓
Registra data/hora
      ↓
Atualiza Histórico
```

---

# Fluxo de Permissões

## FL-ADM-003 — Verificação de Acesso

Antes de executar uma operação protegida:

```text
Usuário solicita operação
        ↓
Sistema identifica usuário
        ↓
Identifica Congregação
        ↓
Identifica Perfil
        ↓
Verifica Permissão
        ↓
┌────────────────────┐
│                    │
Autorizado         Negado
│                    │
↓                    ↓
Executar           Bloquear
operação           operação
```

As permissões deverão ser verificadas no servidor e não somente na interface.

---

# Fluxos Críticos

Os seguintes fluxos são considerados críticos para o funcionamento do SIPD:

| Código | Fluxo | Criticidade |
|--------|-------|-------------|
| FL-PRO-001 | Criar Programação | Alta |
| FL-PRO-002 | Programação → Convite | Alta |
| FL-CONV-002 | Aceitação do Convite | Alta |
| FL-CONV-003 | Recusa do Convite | Alta |
| FL-CONV-004 | Substituição de Orador | Alta |
| FL-CONV-005 | Confirmação da Apresentação | Alta |
| FL-PRO-004 | Realização da Programação | Alta |
| FL-INT-002 | Detecção de Conflitos | Alta |
| FL-ADM-003 | Verificação de Acesso | Alta |

---

# Matriz de Rastreabilidade

| Fluxo | Casos de Uso Relacionados | Principais Entidades |
|-------|---------------------------|-----------------------|
| FL-ADM-001 | UC-ADM-001, UC-ADM-004 | Usuário, Perfil |
| FL-ADM-002 | UC-ADM-002, UC-ADM-003 | Usuário |
| FL-CGR-001 | UC-CGR-001, UC-CGR-002 | Congregação, Usuário |
| FL-CGR-002 | UC-CGR-003, UC-ADM-005 | Usuário, Perfil |
| FL-ORA-001 | UC-ORA-001 | Orador, Congregação |
| FL-ORA-002 | UC-ORA-004, UC-ORA-005 | Orador, Tema, Tema Preparado |
| FL-ORA-003 | UC-ORA-007 | Orador, Usuário |
| FL-CAT-001 | UC-CAT-001, UC-CAT-002 | Tema, Categoria |
| FL-PRO-001 | UC-PRO-001 | Programação, Tema, Orador |
| FL-PRO-002 | UC-PRO-001, UC-CONV-001 | Programação, Convite |
| FL-PRO-003 | UC-PRO-002 | Programação |
| FL-PRO-004 | UC-PRO-006 | Programação, Histórico |
| FL-PRO-005 | UC-PRO-003 | Programação, Convite |
| FL-CONV-001 | UC-CONV-001, UC-CONV-002 | Convite, Programação, Orador |
| FL-CONV-002 | UC-CONV-005 | Convite, Confirmação |
| FL-CONV-003 | UC-CONV-006 | Convite, Programação |
| FL-CONV-004 | UC-INT-001 | Orador, Convite, Programação |
| FL-CONV-005 | UC-CONV-005 | Confirmação, Convite |
| FL-REL-001 | UC-REL-001 a UC-REL-005 | Programação, Orador, Convite, Histórico |
| FL-REL-002 | UC-REL-006 | Relatórios |
| FL-CONF-001 | UC-CONF-001, UC-CONF-002 | Usuário |
| FL-CONF-002 | UC-CONF-003 | Usuário |
| FL-INT-001 | UC-INT-001 | Orador, Tema, Tema Preparado |
| FL-INT-002 | UC-INT-002 | Programação, Orador, Convite |
| FL-INT-003 | UC-INT-003 | Tema, Programação, Histórico |
| FL-INT-004 | UC-INT-004, UC-INT-005 | Programação, Convite, Confirmação |
| FL-INT-005 | UC-INT-006, UC-INT-007 | Histórico, Programação, Convite |
| FL-ADM-003 | UC-ADM-005, UC-ADM-006, UC-ADM-007 | Usuário, Perfil, Permissão |

---

# Princípios dos Fluxos

Os fluxos do SIPD deverão seguir os seguintes princípios:

- Toda operação deverá respeitar as permissões do usuário.
- Toda operação deverá respeitar as regras de negócio.
- Operações críticas deverão ser validadas antes da gravação.
- Conflitos deverão ser identificados antes que uma Programação inválida seja criada.
- A Inteligência deverá auxiliar o usuário, não substituir sua decisão.
- Ações relevantes deverão permanecer registradas no Histórico.
- Dados de uma Congregação não poderão ser expostos indevidamente a outra.
- Os fluxos deverão permanecer consistentes com o Modelo de Domínio e os Casos de Uso.

---

# Considerações Finais

O documento 07 - Fluxos estabelece a visão processual do SIPD.

Enquanto o Modelo de Domínio define o que existe, os Casos de Uso definem o que o sistema permite fazer, e os Fluxos definem como essas operações acontecem.

O fluxo central do SIPD é:

```text
Programação
    ↓
Tema
    ↓
Orador
    ↓
Convite
    ↓
Resposta
    ↓
Confirmação
    ↓
Realização
    ↓
Histórico
```

Toda evolução funcional do sistema deverá manter consistência com os fluxos definidos neste documento.
