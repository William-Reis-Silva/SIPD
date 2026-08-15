# 11 - Permissões

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.0

---

# Objetivo

Este documento consolida, em um único local, quais Perfis do SIPD podem executar cada Caso de Uso do sistema.

Serve como referência para:

- implementação das políticas de acesso na interface;
- implementação das políticas de acesso no banco de dados (RLS ou equivalente);
- definição de testes de autorização;
- auditoria de permissões concedidas por Perfil.

Este documento não redefine nenhuma regra — ele consolida o que já está definido no `02-Glossario.md`, em `04-Regras-de-Negocio.md` e nos campos "Atores" e "Permissões" de cada Caso de Uso detalhado em `06.1.1` a `06.1.9`. Em caso de divergência futura, esses documentos-fonte prevalecem sobre esta consolidação.

## Nota sobre a base utilizada

A matriz deste documento foi construída a partir dos Casos de Uso detalhados em `06.1.1` a `06.1.9` (54 UCs ao todo), que constituem a especificação canônica de cada funcionalidade.

O inventário resumido em `06 - Casos-de-Uso.md` esteve desatualizado em relação a esses documentos logo após a criação deste arquivo: continha 48 UCs, com quantidades, códigos e nomes divergentes nos módulos de Oradores, Catálogo, Programações, Convites, Relatórios e Configurações, além de usar o prefixo `CFG` onde os documentos detalhados usam `CONF`. Essa divergência foi reconciliada em 2026-08-12 (ver `STATUS.md`) — `06 - Casos-de-Uso.md` (v1.4) agora reflete os mesmos 54 UCs desta matriz.

---

# Perfis do Sistema

Definições completas em `02-Glossario.md`. Resumo:

## Administrador Global

Possui acesso irrestrito ao sistema. Administra congregações, usuários, perfis, permissões e a base global de temas (importação S-99).

## Coordenador

Responsável pela administração completa da sua congregação: usuários, oradores, programações, convites, relatórios e configurações da congregação.

## Editor

Responsável pela operação diária dentro da sua congregação: cadastra oradores, cria e edita programações, envia convites, consulta relatórios. Não administra usuários nem configurações da congregação.

## Leitor

Acesso somente para consulta: programações, oradores, temas, relatórios e histórico. Não altera informações do sistema.

---

# Princípios Gerais de Permissão

- **Um Perfil por usuário** — todo usuário possui exatamente um Perfil, que determina todas as suas permissões (RN-003, RN-010, RN-011, RN-012).
- **Escopo por congregação** — um usuário administra apenas sua própria congregação, conforme as permissões do seu Perfil (RN-004). O Administrador Global é a única exceção: pode acessar informações administrativas de qualquer congregação (RN-100).
- **Dados pessoais** — qualquer usuário pode alterar seus próprios dados pessoais, independentemente do Perfil; alterar dados de terceiros exige permissão administrativa (RN-005).
- **Aplicação em duas camadas** — as permissões devem ser aplicadas tanto na interface quanto nas regras de acesso ao banco de dados, nunca apenas em uma delas (RN-101).
- **Auditoria** — toda operação crítica (criação, edição, cancelamento, importação em lote, gestão de usuários/perfis/permissões) deve ser registrada para fins de auditoria (RN-102).
- **Acesso irrestrito do Administrador Global** — salvo indicação em contrário na matriz abaixo, o Administrador Global possui acesso de leitura e escrita a todas as funcionalidades operacionais do sistema, mesmo quando um Caso de Uso específico em `06.1.x` não o cita explicitamente como Ator. Essa regra não se aplica a ações que sejam, por definição, exclusivas da identidade do Orador destinatário (aceitar/recusar convite, enviar confirmação) — essas dependem de quem recebeu o convite, não do Perfil de quem opera o sistema.
- **Orador não é um Perfil** — Orador é uma entidade própria do domínio, com ou sem conta de usuário vinculada (RN-034, RN-035). Quando um Orador possui conta vinculada, ele pode responder convites e enviar confirmações diretamente, independentemente de possuir ou não um dos 4 Perfis do sistema.
- **Sistema não é um Perfil** — alguns Casos de Uso (verificação de conflito, alerta de repetição de tema) são executados automaticamente pelo Sistema, sem acionamento direto por um usuário; não fazem parte da matriz de Perfis abaixo.

---

# Matriz de Permissões por Caso de Uso

Legenda: **AG** = Administrador Global · **C** = Coordenador · **E** = Editor · **L** = Leitor.

## Administração

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-ADM-001 | Autenticar Usuário | ✅ | ✅ | ✅ | ✅ |
| UC-ADM-002 | Recuperar Senha | ✅ | ✅ | ✅ | ✅ |
| UC-ADM-003 | Alterar Senha | ✅ | ✅ | ✅ | ✅ |
| UC-ADM-004 | Encerrar Sessão | ✅ | ✅ | ✅ | ✅ |
| UC-ADM-005 | Gerenciar Usuários | ✅ | ✅ | ✅¹ | ❌ |
| UC-ADM-006 | Gerenciar Perfis | ✅ | ❌ | ❌ | ❌ |
| UC-ADM-007 | Gerenciar Permissões | ✅ | ❌ | ❌ | ❌ |

¹ Editor: apenas quando possuir a permissão específica concedida (não é padrão do Perfil).

## Congregações

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-CGR-001 | Consultar Congregação | ✅ | ✅ | ✅ | ✅ |
| UC-CGR-002 | Atualizar Dados da Congregação | ✅ | ✅ | ❌ | ❌ |
| UC-CGR-003 | Gerenciar Usuários da Congregação | ✅ | ✅ | ❌ | ❌² |

² Leitor: pode apenas consultar os usuários da congregação, não gerenciá-los.

## Oradores

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-ORA-001 | Cadastrar Orador | ✅ | ✅ | ✅ | ❌ |
| UC-ORA-002 | Editar Orador | ✅ | ✅ | ✅ | ❌ |
| UC-ORA-003 | Consultar Orador | ✅ | ✅ | ✅ | ✅ |
| UC-ORA-004 | Registrar Temas Preparados | ✅ | ✅ | ✅ | ❌ |
| UC-ORA-005 | Atualizar Temas Preparados | ✅ | ✅ | ✅ | ❌ |
| UC-ORA-006 | Consultar Histórico do Orador | ✅ | ✅ | ✅ | ✅ |
| UC-ORA-007 | Vincular Conta ao Orador | ✅ | ✅³ | ❌ | ❌ |

³ Coordenador: conforme permissão concedida. O próprio Orador também pode iniciar o vínculo durante o processo de reivindicação de perfil (RN-035) — ação exclusiva da identidade do Orador, não um Perfil do sistema.

## Catálogo de Temas

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-CAT-001 | Consultar Temas | ✅ | ✅ | ✅ | ✅ |
| UC-CAT-002 | Consultar Categorias | ✅ | ✅ | ✅ | ✅ |
| UC-CAT-003 | Cadastrar Tema | ✅ | ❌ | ❌ | ❌ |
| UC-CAT-004 | Editar Tema | ✅ | ❌ | ❌ | ❌ |
| UC-CAT-005 | Cadastrar Categoria | ✅ | ❌ | ❌ | ❌ |
| UC-CAT-006 | Editar Categoria | ✅ | ❌ | ❌ | ❌ |
| UC-CAT-007 | Importar Catálogo S-99 | ✅ | ❌ | ❌ | ❌ |

A base de Temas e Categorias é global e administrada exclusivamente pelo Administrador Global (RN-040).

## Programações

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-PRO-001 | Criar Programação | ✅ | ✅ | ✅ | ❌ |
| UC-PRO-002 | Editar Programação | ✅ | ✅ | ✅ | ❌ |
| UC-PRO-003 | Cancelar Programação | ✅ | ✅ | ✅ | ❌ |
| UC-PRO-004 | Consultar Agenda | ✅ | ✅ | ✅ | ✅ |
| UC-PRO-005 | Consultar Calendário | ✅ | ✅ | ✅ | ✅ |
| UC-PRO-006 | Confirmar Realização | ✅ | ✅ | ✅ | ❌ |

## Convites

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-CONV-001 | Criar Convite | ✅ | ✅ | ✅ | ❌ |
| UC-CONV-002 | Enviar Convite | ✅ | ✅ | ✅ | ❌ |
| UC-CONV-003 | Reenviar Convite | ✅ | ✅ | ✅ | ❌ |
| UC-CONV-004 | Cancelar Convite | ✅ | ✅ | ✅ | ❌ |
| UC-CONV-005 | Aceitar Convite | ❌⁴ | ❌⁴ | ❌⁴ | ❌⁴ |
| UC-CONV-006 | Recusar Convite | ❌⁴ | ❌⁴ | ❌⁴ | ❌⁴ |
| UC-CONV-007 | Confirmar Convite | ❌⁴ | ❌⁴ | ❌⁴ | ❌⁴ |

⁴ Ação exclusiva do Orador destinatário do convite (RN-036). Nenhum dos 4 Perfis do sistema executa essa ação em nome do Orador — Orador não é um Perfil.

A consulta de convites não possui Caso de Uso próprio em `06.1.6`; é coberta pela Agenda/Calendário (UC-PRO-004/005), pelo Dashboard (UC-INT-005) e pelo Relatório de Convites (UC-REL-004).

## Relatórios

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-REL-001 | Consultar Relatórios | ✅ | ✅ | ✅ | ✅ |
| UC-REL-002 | Relatório de Programações | ✅ | ✅ | ✅ | ✅ |
| UC-REL-003 | Relatório de Oradores | ✅ | ✅ | ✅ | ✅ |
| UC-REL-004 | Relatório de Convites | ✅ | ✅ | ✅ | ✅ |
| UC-REL-005 | Relatório de Histórico | ✅ | ✅ | ✅ | ✅ |
| UC-REL-006 | Exportar Relatório | ✅ | ✅ | ✅ | ✅ |

Todo o módulo de Relatórios é somente leitura — os 4 Perfis têm acesso, cada um restrito aos relatórios da sua congregação (exceto Administrador Global, RN-100).

## Configurações

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-CONF-001 | Consultar Perfil | ✅ | ✅ | ✅ | ✅ |
| UC-CONF-002 | Editar Perfil | ✅ | ✅ | ✅ | ✅ |
| UC-CONF-003 | Alterar Preferências | ✅ | ✅ | ✅ | ✅ |
| UC-CONF-004 | Consultar Configurações da Congregação | ✅ | ✅⁵ | ✅ | ✅ |

⁵ Coordenador: também administra as configurações permitidas, além de consultá-las. Editor e Leitor têm acesso apenas de consulta.

## Inteligência

| Código | Caso de Uso | AG | C | E | L |
|---|---|---|---|---|---|
| UC-INT-001 | Sugerir Oradores | ✅ | ✅ | ✅ | ❌ |
| UC-INT-002 | Detectar Conflitos | — | — | — | — |
| UC-INT-003 | Alertar Repetição de Tema | — | — | — | — |
| UC-INT-004 | Identificar Pendências | ✅ | ✅ | ✅ | ❌ |
| UC-INT-005 | Gerar Dashboard | ✅ | ✅ | ✅ | ✅ |
| UC-INT-006 | Gerar Indicadores | ✅ | ✅ | ✅ | ❌ |
| UC-INT-007 | Gerar Estatísticas | ✅ | ✅ | ✅ | ❌ |

UC-INT-002 e UC-INT-003 são executados automaticamente pelo Sistema, sem acionamento direto por um Perfil — não se aplica a noção de permissão de acesso nesses dois casos.

---

# Considerações Finais

Este documento reflete o estado das permissões definidas nos Casos de Uso detalhados (`06.1.1` a `06.1.9`) na data de sua elaboração.

Qualquer alteração de Perfil, Ator ou Permissão em um Caso de Uso deverá ser refletida nesta matriz para que ela permaneça confiável como referência de implementação.

A regra geral prevalece sobre a exceção: no silêncio de um Caso de Uso específico quanto ao Administrador Global, aplica-se o princípio de acesso irrestrito descrito acima, e não a ausência de permissão.
