# 14 - Roadmap

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.0

---

# Objetivo

Este documento consolida, em um único lugar, o caminho entre o estado atual do projeto (documentação da V1 praticamente concluída) e a implementação da V1, além da evolução já planejada para as versões futuras (V2 e V3).

Este documento não define escopo novo — ele organiza compromissos já assumidos em `03-PRD.md` ("Evolução Prevista"), `10-Arquitetura.md` ("Evolução Futura") e `13-ADR.md`, e propõe uma ordem de construção para a V1 derivada das dependências já visíveis entre os módulos de `06.1.x`.

---

# Status Atual

A documentação oficial do SIPD está com 26 de 28 documentos concluídos (ver `STATUS.md`). Restam apenas este documento (`14-Roadmap.md`) e `15-Ideias-Futuras.md`.

Com a conclusão de `11-Permissoes.md`, `12-API.md` e `13-ADR.md`, a V1 já possui um contrato concreto para implementação: quais Perfis podem executar cada Caso de Uso, qual endpoint/mecanismo Supabase implementa cada um, e o porquê registrado das decisões arquiteturais que os sustentam. Nenhum código de aplicação foi escrito ainda — a V1 está totalmente especificada, não construída.

---

# Fase de Implementação da V1

A ordem abaixo é uma sequência sugerida, derivada das dependências de dados já visíveis nos Casos de Uso (`06.1.1` a `06.1.9`) e no DER (`08-DER.md`) — não um cronograma com datas ou estimativas de esforço, que este documento não define.

1. **Administração** (`06.1.1`) — autenticação, usuários e perfis precisam existir antes de qualquer outro módulo, pois todo Caso de Uso subsequente exige um usuário autenticado e um Perfil atribuído (RN-001, RN-003).
2. **Congregações** (`06.1.2`) — todo Usuário e todo Orador se vinculam a uma Congregação (RN-002, RN-030); é a segunda dependência de base.
3. **Catálogo de Temas** (`06.1.4`) — base global (RN-040), independente de Congregação; pode ser construído em paralelo ao módulo de Oradores, mas precisa existir antes de Programações.
4. **Oradores** (`06.1.3`) — depende de Congregações (congregação de origem, RN-030) e de Catálogo de Temas (temas preparados, RN-031).
5. **Programações** (`06.1.5`) — depende de Congregações, Oradores e Temas simultaneamente (RN-050).
6. **Convites** (`06.1.6`) — depende de Programações e Oradores (RN-060, RN-061).
7. **Relatórios** (`06.1.7`) e **Configurações** (`06.1.8`) — consultam dados já produzidos pelos módulos anteriores; podem ser construídos em paralelo, ao final.
8. **Inteligência** (`06.1.9`) — o Motor de Regras (alertas, sugestões, conflitos, Dashboard) consulta dados de Programações, Convites e Histórico; é o último módulo por depender de todos os anteriores para ter dados sobre os quais operar.

O Histórico (RN-080 a RN-083) não é um módulo à parte na sequência acima — é um efeito colateral (trigger/registro) presente desde o primeiro módulo que grava dados (Administração em diante), não uma etapa isolada.

---

# Versão 2 — Evolução Prevista

Itens confirmados em `03-PRD.md` ("Evolução Prevista — Versão 2"), com a leitura de prontidão arquitetural já registrada em `10-Arquitetura.md` ("Evolução Futura") e `13-ADR.md`:

| Item | Por que a arquitetura já está preparada |
|---|---|
| Aplicativos nativos Android/iOS | O mesmo código Expo que gera o build Web (PWA) da V1 pode ser compilado como app nativo via EAS, sem duplicar regras de negócio, que vivem no servidor (`10-Arquitetura.md`, "Evolução Futura"; ADR-004). |
| Notificações (push) | A tabela `notificacoes` já é desacoplada do canal de entrega desde a V1 — adicionar push é trocar o canal, não redesenhar o dado (`10-Arquitetura.md`, "Evolução Futura"). |
| Compartilhamento entre congregações | Já suportado pelo modelo de Base Global (Orador e Tema não pertencem a uma única Congregação — RN-023, RN-032, RN-040; `10-Arquitetura.md`, "Evolução Futura"). |
| Portal do Orador | Depende do vínculo Orador–Usuário já modelado desde a V1 (RN-034 a RN-036, `06.1.3` UC-ORA-007) — a V1 já permite que um Orador com conta vinculada responda convites e envie confirmações diretamente; um portal dedicado estende essa base, não a recria. |
| Dashboard Analítico | Estende `UC-INT-005` (Dashboard, V1), que já agrega Programações, Convites, Confirmações e Histórico — a V2 aprofunda a análise sobre a mesma base de dados. |

---

# Versão 3 — Evolução Prevista

Itens confirmados em `03-PRD.md` ("Evolução Prevista — Versão 3"), todos dependentes da mesma decisão arquitetural (ADR-003):

| Item | Por que a arquitetura já está preparada |
|---|---|
| Inteligência Artificial | O módulo de Inteligência (`06.1.9`) já isola toda a lógica de sugestão em funções RPC — essas funções são substituíveis por um serviço de IA sem alterar os Casos de Uso que as consomem (`10-Arquitetura.md`, "Evolução Futura"; ADR-003). |
| Sugestões automáticas | Evolução direta de `UC-INT-001` (Sugerir Oradores, V1, hoje determinístico) para um modelo que aprenda com padrões de uso. |
| Assistente de programação | Não tem equivalente direto na V1; depende da infraestrutura de IA acima existir primeiro. |
| Relatórios inteligentes | Evolução de `UC-REL-001` a `006` (Relatórios, V1, hoje consultas estruturadas) para geração de insights automatizados. |
| Recomendações baseadas em histórico | Depende do histórico acumulado durante a V1 e a V2 (RN-080 a RN-083) como base de treinamento/análise. |

A V1 não implementa nenhum desses itens nem antecipa sua arquitetura além de manter a lógica de sugestão isolada em funções substituíveis (ADR-003) — não há dependência de aprendizado de máquina em nenhum Caso de Uso da V1.

---

# Fora de Escopo, Sem Versão Definida

`03-PRD.md` ("Fora do Escopo (V1)") lista dois itens que **não** reaparecem em nenhuma versão futura comprometida (V2 ou V3) em nenhum outro documento da série — permanecem como backlog não agendado, não como evolução planejada:

- **Integração com WhatsApp**
- **Integração com Google Calendar**

Diferem dos demais itens dessa mesma seção do PRD (Push Notifications, Inteligência Artificial, Portal Web, Compartilhamento automático entre congregações), que embora também estejam fora do escopo da V1, já têm destino certo em V2 ou V3 conforme as seções acima.

---

# Considerações Finais

Este roadmap deverá ser revisado sempre que `03-PRD.md` ("Evolução Prevista") ou `10-Arquitetura.md` ("Evolução Futura") forem alterados, para que as três fontes permaneçam consistentes entre si.

A ordem de implementação da V1 proposta aqui é uma sugestão baseada em dependências de dados, não uma decisão registrada em ADR — pode ser ajustada livremente conforme a equipe de desenvolvimento avaliar prioridades operacionais (ex.: um módulo com menor dependência técnica, mas maior valor para o usuário final, pode justificar adiantar sua construção).
