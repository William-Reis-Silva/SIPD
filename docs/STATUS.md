# STATUS

> Sistema Inteligente de Programação de Discursos (SIPD)

Este documento acompanha o progresso da documentação oficial do projeto.

---

# Status da Documentação

| Documento | Situação |
|------------|----------|
| ✅ 00 - Visão do Projeto | Concluído |
| ✅ 01 - Princípios | Concluído |
| ✅ 02 - Glossário | Concluído |
| ✅ 03 - PRD | Concluído |
| ✅ 04 - Regras de Negócio | Concluído |
| ✅ 05 - Modelo de Domínio | Concluído |
| ✅ 05.1 - Domain Map | Concluído |
| ✅ 05.2 - Mapa Funcional | Concluído |
| ✅ 06 - Casos de Uso (inventário) | Concluído |
| ✅ 06.1 - Especificação dos Casos de Uso (padrão) | Concluído |
| ✅ 06.1.1 - Administração | Concluído |
| ✅ 06.1.2 - Congregações | Concluído |
| ✅ 06.1.3 - Oradores | Concluído |
| ✅ 06.1.4 - Catálogo de Temas | Concluído |
| ✅ 06.1.5 - Programações | Concluído |
| ✅ 06.1.6 - Convites | Concluído |
| ✅ 06.1.7 - Relatórios | Concluído |
| ✅ 06.1.8 - Configurações | Concluído |
| ✅ 06.1.9 - Inteligência | Concluído |
| ✅ 07 - Fluxos | Concluído |
| ✅ 08 - DER | Concluído |
| ✅ 09 - Dicionário de Dados | Concluído |
| ✅ 10 - Arquitetura | Concluído |
| ✅ 11 - Permissões | Concluído |
| ✅ 12 - API | Concluído |
| ✅ 13 - ADR | Concluído |
| ✅ 14 - Roadmap | Concluído |
| ✅ 15 - Ideias Futuras | Concluído |

---

## Legenda

- ⬜ Não iniciado
- 🟡 Em desenvolvimento
- ⚠️ Desatualizado / requer revisão
- ✅ Concluído

---

## Progresso

**Concluído:** 28 de 28 documentos

**Não iniciado:** 0 documentos

Os 28 documentos planejados da documentação oficial do SIPD estão concluídos. Próximos achados ou decisões devem ser registrados como novas entradas no Histórico de Correções abaixo, como ADR em `13-ADR.md`, ou como ideia em `15-Ideias-Futuras.md`, conforme o caso — não como novo documento numerado, salvo decisão explícita de expandir o conjunto.

---

## Histórico de Correções

Auditoria de consistência realizada em 2026-08-09, com correções complementares em 2026-08-12.

- **2026-08-18 — Numeração de RN incorreta em `06.1.4 - Catálogo_Temas.md`.** Os 7 UCs citavam RN-030 a RN-033 (regras de Orador) como "Regras de Negócio Relacionadas", quando as regras de Temas são RN-040 a RN-043 — mesmo padrão "+10 na dezena" já corrigido em outros arquivos em 2026-08-12, que havia escapado daquela auditoria. Corrigido em todos os 7 UCs e na Matriz de Rastreabilidade; versão incrementada para 1.3.
- **2026-08-12 — `15-Ideias-Futuras.md` criado — documentação oficial concluída (28/28).** Parking lot de ideias mencionadas de passagem na documentação técnica, nunca promovidas a escopo em `03-PRD.md`: cálculo de proximidade geográfica Orador↔Congregação (`08-DER.md`), permissões personalizadas por Usuário/Congregação (em tensão explícita com ADR-005, sem contradizê-lo), novos atributos para Tema Preparado (`05-Modelo-de-Dominio.md`), novas preferências de usuário configuráveis (`06.1.8`). Distinto de `14-Roadmap.md` (que cobre apenas o já comprometido) — nada aqui é compromisso ou escopo definido. Também corrigida, em `11-Permissoes.md`, uma nota que ainda descrevia a divergência do inventário `06 - Casos-de-Uso.md` como não resolvida (havia sido corrigida em item anterior deste changelog).
- **2026-08-12 — `14-Roadmap.md` criado.** Consolida o caminho da documentação (praticamente concluída) até a implementação da V1, com uma ordem de construção sugerida por módulo derivada das dependências de dados já visíveis em `06.1.x` (Administração → Congregações → Catálogo de Temas → Oradores → Programações → Convites → Relatórios/Configurações → Inteligência), sem datas ou estimativas. Também organiza a Evolução Prevista de `03-PRD.md` em V2 e V3, cruzando cada item com a prontidão arquitetural já registrada em `10-Arquitetura.md` ("Evolução Futura") e nos ADRs 003/004; identifica Integração com WhatsApp e com Google Calendar como os únicos itens "fora do escopo V1" sem versão futura comprometida (backlog não agendado).
- **2026-08-12 — `13-ADR.md` criado.** Registro retroativo de 9 Architecture Decision Records, formalizando decisões já implícitas em `10-Arquitetura.md`, `03-PRD.md`, `02-Glossario.md`, `04-Regras-de-Negocio.md` e no histórico deste changelog: BaaS/Supabase sem backend próprio, RLS como segurança real, Motor de Regras determinístico sem IA na V1, PWA como alvo da V1, 4 Perfis fixos, Orador independente de Usuário/Perfil, multi-tenancy por `congregacao_id`, catálogo global de Temas (S-99), uso restrito de Edge Functions. Cada ADR cita a seção-fonte para verificação; novas decisões futuras devem virar ADR-010 em diante, não apenas prosa neste changelog.
- **2026-08-12 — `12-API.md` criado.** Detalha, por Caso de Uso, o mecanismo Supabase correspondente (Tabela direta/PostgREST, RPC, Edge Function, Storage ou Auth SDK) e o endpoint, com base na arquitetura já definida em `10-Arquitetura.md` — não uma REST genérica. Cobre os 54 UCs; judgment calls documentados em rodapé no próprio arquivo (ex.: RPC vs. tabela direta para Cancelar Programação/Confirmar Realização/Vincular Conta; inferência de Edge Function para convidar usuário e exportar relatório; lacuna de schema sinalizada para Preferências/Configurações da Congregação, a confirmar em `08-DER.md`).
- **2026-08-12 — `11-Permissoes.md` criado.** Matriz de permissões Perfil × Caso de Uso, consolidando os campos "Atores"/"Permissões" dos 54 UCs detalhados em `06.1.1` a `06.1.9`, mais os princípios gerais de permissão (RN-003/004/005/010-012/100-102).
- **2026-08-12 — Inventário `06 - Casos-de-Uso.md` desatualizado — resolvido.** Reconciliado contra os 54 UCs reais de `06.1.1`–`06.1.9` (achado ao montar `11-Permissoes.md`). Correções: Oradores 8→7 linhas (UC-ORA-008 "Reivindicar Cadastro" era duplicata de UC-ORA-007, que já cobre a reivindicação); Catálogo 2→7 linhas (faltavam Cadastrar/Editar Tema, Cadastrar/Editar Categoria, Importar S-99); Programações 8→6 linhas (UC-PRO-007 "Trocar Orador" e UC-PRO-008 "Alterar Tema" eram fictícios, cobertos por UC-PRO-002 Editar Programação); Convites 8→7 linhas (UC-CONV-003 "Consultar Convite" fictício; UC-CONV-008 renomeado/renumerado para UC-CONV-007 "Confirmar Convite"); Relatórios 3→6 linhas (nomes e códigos totalmente realinhados a `06.1.7`); Configurações 2→4 linhas, prefixo `CFG`→`CONF` (na tabela de Prefixos e em todos os códigos). Também corrigidos os nomes de 4 UC-INT-* ("Identificar/Gerar" → "Exibir Pendências/Dashboard/Indicadores/Estatísticas", conforme `06.1.9`) e o Ator Principal de `UC-CGR-002/003` (→ Coordenador, Administrador Global) e da maioria dos UC-ORA-* (perfis específicos em vez de "Usuário" genérico). Total final: **54 UCs**, igual ao de `11-Permissoes.md`. `06 - Casos-de-Uso.md` incrementado para v1.4.

- **2026-08-09 — Modelo de Perfis divergente.** `03-PRD.md` e `05.2` descreviam os perfis como Secretário/Coordenador/Administrador Global (tratando Orador como perfil). Realinhados ao modelo oficial: **Administrador Global, Coordenador, Editor, Leitor** (Secretário é Cargo, não Perfil; Orador é entidade própria).
- **2026-08-09 — Nomenclatura de arquivos.** `6.1.5 - Programações.md` → `06.1.5 - Programações.md` (zero à esquerda); `05.2 - Mapa Funcional do Sistema.md` → `05.2-Mapa-Funcional-do-Sistema.md`. Referências erradas a documentos em `09-Dicionario-de-Dados.md` corrigidas.
- **2026-08-09 — Formatação Markdown quebrada.** 11 arquivos (`06.1.2`–`06.1.9`, `07-Fluxos`, `08-DER`, `09-Dicionario-de-Dados`) haviam perdido toda a formatação (sem títulos, listas ou tabelas). Reconstruídos integralmente sem alterar conteúdo. No processo: "Secretário" trocado por "Editor" como Ator em 5 arquivos; tabela `perfis` em `08-DER` e `09` corrigida para o modelo oficial de 4 perfis.
- **2026-08-12 — Numeração de RN incorreta.** Citações de Regras de Negócio inexistentes nos `06.1.x` corrigidas contra `04-Regras-de-Negocio.md`. Padrão identificado — todas estavam a **+10 na dezena** da regra real: RN-014→024, RN-025→035, RN-026→036, RN-045→055, RN-084→094, RN-085→095, RN-087→097. Além disso, 22 citações de RN-092 (usadas no sentido de auditoria) foram reclassificadas para **RN-102**, a regra real de auditoria. Afetados: `06.1.1`–`06.1.5`, `06.1.7`–`06.1.9`, `10-Arquitetura.md` (todos com versão incrementada).
- **2026-08-12 — Ator Principal divergente em UC-INT-*.** O inventário `06 - Casos-de-Uso.md` listava **Sistema** para todos os 7 UC-INT-*, enquanto `06.1.9` detalhava Perfis humanos em 5 deles. Inventário (v1.3) alinhado: UC-INT-001/004 → Coordenador, Editor; UC-INT-005 → Usuário; UC-INT-006/007 → Coordenador, Editor, Administrador Global; UC-INT-002/003 mantidos como Sistema (únicas análises sem tela própria).
- **2026-08-09 — Plataforma descrita como "aplicativo mobile".** Corrigido para **aplicação web responsiva (PWA)** como alvo principal da V1 em `00-Visao-do-Projeto.md`, `03-PRD.md` (v1.2), `10-Arquitetura.md` (v1.1) e `README.md`. Mantido React Native + Expo; apps nativos Android/iOS reposicionados como evolução V2.

---

## Última atualização

**Data:** 12 / 08 / 2026

**Versão da documentação:** 1.0
