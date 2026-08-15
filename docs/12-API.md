  # 12 - API

  > Sistema Inteligente de Programação de Discursos (SIPD)

  **Versão:** 1.0

  ---

  # Objetivo

  Este documento detalha, para cada Caso de Uso com superfície de API (`06.1.1` a `06.1.9`), qual mecanismo do Supabase o implementa e qual o endpoint correspondente.

  Serve como referência para:

  - implementação do schema, das RLS Policies e das funções PostgreSQL no Supabase;
  - implementação do cliente (chamadas ao SDK Supabase a partir da aplicação web);
  - definição de testes de integração por endpoint;
  - rastreabilidade entre Caso de Uso, endpoint e tabela/função.

  Este documento não redefine arquitetura nem permissões — ele detalha, em nível de endpoint, o que já está decidido em `10-Arquitetura.md` (mecanismos: PostgREST, RPC, Edge Functions, Storage, Auth) e em `11-Permissoes.md` (quem pode chamar cada endpoint). Em caso de divergência futura, esses dois documentos prevalecem sobre esta consolidação.

  ---

  # Convenções de Acesso

  - **Base:** todo acesso passa pelo endpoint HTTPS do projeto Supabase; não existe backend próprio (`10-Arquitetura.md`).
  - **Autenticação:** todo endpoint (exceto Login e Recuperar Senha) exige um JWT de sessão válido, emitido pelo Supabase Auth e enviado automaticamente pelo SDK.
  - **Autorização:** nenhuma verificação de permissão é feita em código de aplicação como camada de segurança real — é sempre reforçada por RLS Policy no PostgreSQL (RN-101), conforme a matriz de `11-Permissoes.md`. A interface apenas evita apresentar ações não permitidas (usabilidade, não segurança).
  - **Mapeamento de verbos (PostgREST):**
    - `SELECT` → `GET`, com filtros via query string (ex.: `?congregacao_id=eq.{id}`).
    - `INSERT` → `POST`.
    - `UPDATE` → `PATCH` (o PostgREST não usa `PUT`; os caminhos em estilo `PUT /recurso/{id}` citados nos `06.1.x` são convertidos para `PATCH` neste documento).
    - `DELETE` → `DELETE`.
  - **RPC:** toda função PostgreSQL exposta é chamada via `POST /rest/v1/rpc/{nome_da_funcao}`, com os parâmetros no corpo da requisição, independentemente de a operação ser uma leitura ou uma escrita.
  - **Erros:** seguem o formato padrão do PostgREST/Supabase (`code`, `message`, `details`, `hint`); uma violação de RLS retorna a linha como inexistente (não um erro de permissão explícito), e uma violação de constraint retorna o erro do PostgreSQL correspondente.
  - **Paginação:** listagens usam os headers `Range`/`Range-Unit` do PostgREST (paginação nativa), não parâmetros customizados de página.

  ---

  # Tabela Direta (PostgREST) vs RPC vs Edge Function vs Storage

  | Mecanismo | Quando é usado | Reforço de segurança |
  |---|---|---|
  | **Tabela/View direta (PostgREST)** | CRUD simples: consultar, criar ou editar um registro dentro do escopo do Perfil, sem lógica adicional além de constraints | RLS Policy por tabela |
  | **RPC (função PostgreSQL)** | Lógica de negócio que não se resume a uma linha (Motor de Regras: RN-090 a RN-097, RN-093), agregações (Dashboard, Indicadores, Estatísticas, Relatórios) ou validações compostas (ex.: vincular conta ao Orador) | A própria função valida `auth.uid()` e o escopo; pode chamar RLS internamente |
  | **Edge Function** | Operações que coordenam múltiplas tabelas como uma transação atômica com efeito colateral (ex.: criar Convite + Notificação), exigem privilégio elevado (`service_role`, ex.: convidar um novo Usuário via Supabase Auth Admin API) ou processam um arquivo antes de gravar (ex.: importar o Catálogo S-99) | Roda com `service_role`, portanto valida permissão internamente antes de qualquer escrita — nunca reforçado apenas por RLS |
  | **Supabase Storage** | Upload/download de arquivos anexados a uma Confirmação (RN-072) | Storage Policy equivalente à RLS, pelo mesmo critério (`congregacao_id`) |
  | **Supabase Auth SDK** | Autenticação, sessão e recuperação de senha (UC-ADM-001 a 004) | Nativo do Supabase Auth; não passa pela API de dados |

  Esta classificação segue diretamente os critérios já registrados em `10-Arquitetura.md` (seções "Motor de Regras", "Módulo de Inteligência" e "Edge Functions") — não foram inventados novos critérios para este documento.

  ---

  # Endpoints por Módulo

  ## Administração

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-ADM-001 | Autenticar Usuário | — | `signInWithPassword()` | Supabase Auth SDK | `auth.users` |
  | UC-ADM-002 | Recuperar Senha | — | `resetPasswordForEmail()` | Supabase Auth SDK | `auth.users` |
  | UC-ADM-003 | Alterar Senha | — | `updateUser({ password })` | Supabase Auth SDK | `auth.users` |
  | UC-ADM-004 | Encerrar Sessão | — | `signOut()` | Supabase Auth SDK | `auth.users` |
  | UC-ADM-005 | Gerenciar Usuários | GET/POST/PATCH | `/rest/v1/usuarios` | Tabela direta | `usuarios` |
  | UC-ADM-006 | Gerenciar Perfis | GET/PATCH | `/rest/v1/perfis` (leitura), `/rest/v1/usuarios?id=eq.{id}` (atribuição) | Tabela direta | `perfis`, `usuarios` |
  | UC-ADM-007 | Gerenciar Permissões | GET | `/rest/v1/perfis` | Tabela direta¹ | `perfis` |

  ¹ Na V1 as permissões por Perfil são fixas (definidas em `11-Permissoes.md` e implementadas como RLS Policies), não editáveis via API — `06.1.1` já registra isso como FA-01 ("permissões fixas"). Não existe endpoint de escrita para este UC na V1.

  ## Congregações

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-CGR-001 | Consultar Congregação | GET | `/rest/v1/congregacoes?id=eq.{id}` | Tabela direta | `congregacoes` |
  | UC-CGR-002 | Atualizar Dados da Congregação | PATCH | `/rest/v1/congregacoes?id=eq.{id}` | Tabela direta | `congregacoes` |
  | UC-CGR-003 | Gerenciar Usuários da Congregação | GET | `/rest/v1/usuarios?congregacao_id=eq.{id}` | Tabela direta | `usuarios` |
  | | | POST | `/functions/v1/convidar-usuario` | Edge Function² | `usuarios` + `auth.users` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` | Tabela direta | `usuarios` |
  | | | PATCH | `/rest/v1/usuarios?id=eq.{id}` (campo `ativo`) | Tabela direta | `usuarios` |

  ² Convidar um novo usuário exige criar a credencial em `auth.users` via Supabase Auth Admin API, que só pode ser chamada com `service_role` — não é possível a partir do cliente, por isso é Edge Function, não uma escrita direta na tabela `usuarios`.

  ## Oradores

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-ORA-001 | Cadastrar Orador | POST | `/rest/v1/oradores` | Tabela direta | `oradores` |
  | UC-ORA-002 | Editar Orador | PATCH | `/rest/v1/oradores?id=eq.{id}` | Tabela direta | `oradores` |
  | UC-ORA-003 | Consultar Orador | GET | `/rest/v1/oradores` | Tabela direta | `oradores` |
  | UC-ORA-004 | Registrar Temas Preparados | POST | `/rest/v1/temas_preparados` | Tabela direta | `temas_preparados` |
  | UC-ORA-005 | Atualizar Temas Preparados | PATCH/DELETE | `/rest/v1/temas_preparados?id=eq.{id}` | Tabela direta | `temas_preparados` |
  | UC-ORA-006 | Consultar Histórico do Orador | GET | `/rest/v1/historicos?...` (filtrado por Orador via `programacao_id`) | Tabela direta | `historicos` |
  | UC-ORA-007 | Vincular Conta ao Orador | POST | `/rest/v1/rpc/vincular_conta_orador` | RPC³ | `oradores` |

  ³ Vincular exige validar que o telefone normalizado do Orador corresponde ao usuário autenticado (RN-035) e impedir vínculo duplicado — lógica composta, não uma simples escrita de coluna, por isso RPC em vez de `PATCH` direto.

  ## Catálogo de Temas

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-CAT-001 | Consultar Temas | GET | `/rest/v1/temas` | Tabela direta | `temas` |
  | UC-CAT-002 | Consultar Categorias | GET | `/rest/v1/categorias`, `/rest/v1/temas?categoria_id=eq.{id}` | Tabela direta | `categorias`, `temas` |
  | UC-CAT-003 | Cadastrar Tema | POST | `/rest/v1/temas` | Tabela direta | `temas` |
  | UC-CAT-004 | Editar Tema | PATCH | `/rest/v1/temas?id=eq.{id}` | Tabela direta | `temas` |
  | UC-CAT-005 | Cadastrar Categoria | POST | `/rest/v1/categorias` | Tabela direta | `categorias` |
  | UC-CAT-006 | Editar Categoria | PATCH | `/rest/v1/categorias?id=eq.{id}` | Tabela direta | `categorias` |
  | UC-CAT-007 | Importar Catálogo S-99 | POST | `/functions/v1/importar-catalogo` | Edge Function⁴ | `temas`, `categorias` |

  ⁴ Citado explicitamente em `10-Arquitetura.md` ("Edge Functions") como exemplo: processa um arquivo e aplica alterações em lote, com validação prévia — não é uma escrita direta de linha.

  ## Programações

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-PRO-001 | Criar Programação | POST | `/rest/v1/programacoes` | Tabela direta⁵ | `programacoes` |
  | UC-PRO-002 | Editar Programação | PATCH | `/rest/v1/programacoes?id=eq.{id}` | Tabela direta⁵ | `programacoes` |
  | UC-PRO-003 | Cancelar Programação | POST | `/rest/v1/rpc/cancelar_programacao` | RPC⁶ | `programacoes`, `convites`, `historicos` |
  | UC-PRO-004 | Consultar Agenda | GET | `/rest/v1/programacoes` | Tabela direta | `programacoes` |
  | UC-PRO-005 | Consultar Calendário | GET | `/rest/v1/programacoes?data=gte...&data=lte...` | Tabela direta | `programacoes` |
  | UC-PRO-006 | Confirmar Realização | POST | `/rest/v1/rpc/confirmar_realizacao` | RPC⁶ | `programacoes`, `historicos` |

  ⁵ A gravação é protegida pela constraint `UNIQUE (congregacao_id, data)` (RN-051) e por um trigger que bloqueia conflitos (RN-093); o cliente chama `UC-INT-002` (RPC de verificação de conflitos) antes de enviar o `POST`/`PATCH`, como alerta antecipado — a validação definitiva continua no banco.

  ⁶ Cancelar e Confirmar Realização alteram o status da Programação e propagam efeitos a outras tabelas (Convites relacionados; histórico de apresentações do Orador) como uma operação atômica — por isso RPC em vez de `PATCH` direto no status.

  ## Convites

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-CONV-001 | Criar Convite | POST | `/rest/v1/convites` | Tabela direta | `convites` |
  | UC-CONV-002 | Enviar Convite | POST | `/functions/v1/enviar-convite` | Edge Function⁷ | `convites`, `notificacoes` |
  | UC-CONV-003 | Reenviar Convite | POST | `/functions/v1/enviar-convite` (reenvio) | Edge Function⁷ | `convites`, `notificacoes` |
  | UC-CONV-004 | Cancelar Convite | PATCH | `/rest/v1/convites?id=eq.{id}` | Tabela direta⁸ | `convites` |
  | UC-CONV-005 | Aceitar Convite | PATCH | `/rest/v1/convites?id=eq.{id}` | Tabela direta⁸ | `convites` |
  | UC-CONV-006 | Recusar Convite | PATCH | `/rest/v1/convites?id=eq.{id}` | Tabela direta⁸ | `convites` |
  | UC-CONV-007 | Confirmar Convite | POST | `/rest/v1/confirmacoes` | Tabela direta⁸ | `confirmacoes` |

  ⁷ Citado explicitamente em `10-Arquitetura.md` como exemplo de Edge Function: cria/atualiza o Convite e cria a Notificação correspondente como operação atômica.

  ⁸ O registro no Histórico (RN-070/071) e, em UC-CONV-007, a mudança automática da Programação para "Confirmada" (RN-073) são efeitos colaterais implementados via trigger PostgreSQL, não Edge Function — não exigem privilégio elevado nem serviço externo, apenas lógica dentro do próprio banco. Anexos de UC-CONV-007 são enviados separadamente ao **Supabase Storage** (RN-072), com a tabela `confirmacoes` guardando apenas a referência ao arquivo.

  ## Relatórios

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-REL-001 | Consultar Relatórios | — | — | N/A⁹ | — |
  | UC-REL-002 | Relatório de Programações | POST | `/rest/v1/rpc/relatorio_programacoes` | RPC | — (agrega `programacoes`, `congregacoes`, `temas`, `oradores`) |
  | UC-REL-003 | Relatório de Oradores | POST | `/rest/v1/rpc/relatorio_oradores` | RPC | — (agrega `oradores`, `temas_preparados`, `programacoes`) |
  | UC-REL-004 | Relatório de Convites | POST | `/rest/v1/rpc/relatorio_convites` | RPC | — (agrega `convites`, `programacoes`, `oradores`) |
  | UC-REL-005 | Relatório de Histórico | POST | `/rest/v1/rpc/relatorio_historico` | RPC | — (agrega `historicos`, `usuarios`) |
  | UC-REL-006 | Exportar Relatório | POST | `/functions/v1/exportar-relatorio` | Edge Function¹⁰ | — |

  ⁹ UC-REL-001 é a tela de índice que lista os relatórios disponíveis (menu para UC-REL-002 a 006, conforme o próprio Fluxo Principal em `06.1.7`); não executa consulta própria, não há endpoint associado.

  ¹⁰ Gerar um arquivo exportável (PDF/CSV) a partir do resultado de um relatório é processamento fora do modelo de consulta simples do PostgREST — tratado como Edge Function.

  ## Configurações

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-CONF-001 | Consultar Perfil | GET | `/rest/v1/usuarios?id=eq.{auth.uid()}` | Tabela direta | `usuarios` |
  | UC-CONF-002 | Editar Perfil | PATCH | `/rest/v1/usuarios?id=eq.{auth.uid()}` | Tabela direta | `usuarios` |
  | UC-CONF-003 | Alterar Preferências | GET/PATCH | `/rest/v1/usuarios?id=eq.{auth.uid()}` (campo `preferencias`) | Tabela direta¹¹ | `usuarios` |
  | UC-CONF-004 | Consultar Configurações da Congregação | GET | `/rest/v1/congregacoes?id=eq.{id}` (campos de configuração) | Tabela direta¹¹ | `congregacoes` |

  ¹¹ `08-DER.md` ainda não modela colunas específicas para "preferências do usuário" nem para "configurações da congregação" — apenas as tabelas `usuarios` e `congregacoes` já existentes. Este documento assume que esses dados serão adicionados como coluna (ex.: `preferencias JSONB` em `usuarios`) em vez de tabela própria, por serem poucos campos de configuração simples; recomenda-se confirmar isso ao detalhar `08-DER.md`/`09-Dicionario-de-Dados.md` antes da implementação.

  ## Inteligência

  | Código | Caso de Uso | Método | Endpoint | Tipo | Tabela/Função |
  |---|---|---|---|---|---|
  | UC-INT-001 | Sugerir Oradores | POST | `/rest/v1/rpc/sugerir_oradores` | RPC | — (aplica RN-021, RN-022, RN-095 sobre `temas_preparados`, `historicos`, `programacoes`) |
  | UC-INT-002 | Detectar Conflitos | POST | `/rest/v1/rpc/verificar_conflitos` | RPC | — (também chamada por trigger antes de `INSERT`/`UPDATE` em `programacoes`) |
  | UC-INT-003 | Alertar Repetição de Tema | POST | `/rest/v1/rpc/alertar_repeticao_tema` | RPC | — (RN-090, RN-091) |
  | UC-INT-004 | Exibir Pendências | GET | `/rest/v1/rpc/pendencias` ou view `pendencias` | RPC/View | — (agrega `convites`, `confirmacoes`, `programacoes`) |
  | UC-INT-005 | Exibir Dashboard | GET | `/rest/v1/rpc/dashboard` ou view `dashboard` | RPC/View | — (agrega `programacoes`, `convites`, `confirmacoes`, `notificacoes`, `historicos`) |
  | UC-INT-006 | Exibir Indicadores | POST | `/rest/v1/rpc/indicadores` | RPC | — (agrega `programacoes`, `convites`, `confirmacoes`) |
  | UC-INT-007 | Exibir Estatísticas | POST | `/rest/v1/rpc/estatisticas` | RPC | — (agrega dados históricos por período) |

  ---

  # Considerações Finais

  Todo endpoint deste documento é reforçado por RLS Policy (tabelas/views diretas), por validação interna equivalente na própria função (RPC) ou por checagem explícita de permissão antes de qualquer escrita (Edge Function) — nunca apenas pela interface, conforme RN-101 e `10-Arquitetura.md`.

  Os nomes de função RPC e de Edge Function citados aqui (`sugerir_oradores`, `cancelar_programacao`, `enviar-convite`, etc.) são propostos por este documento como convenção inicial; podem ser ajustados durante a implementação, desde que a classificação de mecanismo (Tabela direta / RPC / Edge Function / Storage / Auth SDK) e o Caso de Uso correspondente permaneçam rastreáveis.

  Este documento deverá permanecer alinhado a `10-Arquitetura.md`, `11-Permissoes.md`, `08-DER.md`/`09-Dicionario-de-Dados.md` e aos Casos de Uso detalhados em `06.1.1` a `06.1.9`. Alterações em qualquer um desses documentos que afetem um endpoint aqui listado deverão ser refletidas neste documento.
