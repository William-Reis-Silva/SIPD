# 15 - Ideias Futuras

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.0

---

# Objetivo

Este documento reúne ideias que foram mencionadas de passagem ao longo da documentação técnica do SIPD — em `Observações` de Casos de Uso, no Modelo de Domínio, no DER — como possíveis extensões futuras, mas que nunca foram formalmente promovidas a um item de escopo em `03-PRD.md`.

Ele existe para que essas menções não se percam dentro de parágrafos de outros documentos. Nenhuma ideia registrada aqui é um compromisso, um escopo definido ou uma promessa de entrega.

Este documento **não** é o Roadmap. `14-Roadmap.md` cobre o que já está comprometido: a ordem de implementação da V1 e as evoluções de V2/V3 já prometidas em `03-PRD.md` ("Evolução Prevista"), além dos dois itens sem versão definida mas já explicitamente reconhecidos como backlog (Integração com WhatsApp, Integração com Google Calendar). Nenhum desses itens é repetido aqui — consulte `14-Roadmap.md` para eles.

---

# Ideias Registradas

## Cálculo de proximidade geográfica entre Orador e Congregação

**Onde foi mencionada:** `08-DER.md`, seção "Localização e Inteligência"; `09-Dicionario-de-Dados.md` (linha ~608).

**Do que se trata:** o DER já modela a estrutura `Estado → Cidade → Congregação` e `Estado → Cidade → Orador`, projetada explicitamente para "permitir futuras funcionalidades de inteligência". Em uma versão futura, a tabela `cidades` poderia receber latitude/longitude, permitindo ao Motor de Inteligência calcular a distância entre a Congregação e cada Orador preparado para um Tema. O fluxo conceitual já esboçado em `08-DER.md`: Tema selecionado → Oradores preparados → Cálculo de proximidade → Ordenação → Orador mais próximo … Orador mais distante. O próprio documento já registra a ressalva de que a localização deveria ser usada como critério de apoio, nunca como regra única para a escolha de um Orador.

**Status:** nenhuma coluna de latitude/longitude existe hoje no schema; é uma possibilidade estrutural, não uma funcionalidade especificada.

---

## Permissões personalizadas por Usuário ou por Congregação

**Onde foi mencionada:** `06.1.1 - Administração.md` (Observações do UC-ADM-007 — Gerenciar Permissões): "Permissões personalizadas por Usuário ou por Congregação poderão ser avaliadas em versões futuras." Ecoada em `06.1.2 - Congregações.md`: o Editor poderia editar dados da congregação "quando uma permissão específica futura permitir essa operação".

**Do que se trata:** conceder permissões além (ou distintas) das já fixadas pelo Perfil de um usuário — hoje o sistema não permite isso.

**Tensão com decisão já tomada:** esta ideia está em tensão direta com `13-ADR.md`, ADR-005 ("Modelo de 4 Perfis fixos, sem permissões granulares por usuário"), que é a decisão vigente da V1. Registrar essa ideia aqui não a contradiz — apenas reconhece que os próprios Casos de Uso já anteciparam a possibilidade de revisar essa decisão no futuro. Qualquer avanço nessa direção exigiria reabrir o ADR-005 (marcando-o como Substituído por um novo ADR), não apenas alterar `11-Permissoes.md`.

---

## Novos atributos para Tema Preparado

**Onde foi mencionada:** `05-Modelo-de-Dominio.md`, entidade "Tema Preparado", seção Responsabilidades (linha ~141-145).

**Do que se trata:** hoje a entidade Tema Preparado apenas registra o vínculo entre Orador e Tema. O próprio Modelo de Domínio já lista, como informações futuras possíveis, ainda sem RN ou UC associado: data de preparação, observações, status.

---

## Novas preferências de usuário configuráveis

**Onde foi mencionada:** `06.1.8 - Configurações.md`, Observações do módulo de Preferências (linha ~249): "Novas preferências poderão ser adicionadas em versões futuras sem alterar as regras fundamentais do domínio."

**Do que se trata:** item propositalmente em aberto — os próprios documentos não especificam quais preferências além das já definidas para a V1 poderiam ser adicionadas. Registrado aqui apenas para lembrar que o modelo de Configurações foi desenhado para comportar extensão futura sem redesenho.

---

# Como Usar Este Documento

As ideias acima são candidatas a uma futura sessão de planejamento, não compromissos. Promover qualquer uma delas a escopo real exige, nesta ordem:

1. Atualizar `03-PRD.md` ("Evolução Prevista"), decidindo em qual versão (V2, V3 ou uma nova) a ideia se encaixa;
2. Refletir a decisão em `14-Roadmap.md`, do mesmo modo como esse documento já faz para os itens hoje comprometidos;
3. Se a ideia envolver uma decisão arquitetural (como é o caso da permissão granular vs. ADR-005), registrar ou substituir o ADR correspondente em `13-ADR.md`.

Uma ideia registrada aqui e depois descartada não precisa ser removida — pode ser marcada como descartada, com o motivo, para preservar o histórico de decisão.

---

# Considerações Finais

Com este documento, encerra-se o conjunto de 28 documentos planejados da documentação oficial do SIPD (ver `STATUS.md`). Isso não significa que a documentação está congelada: novas ideias que surgirem durante a implementação da V1 devem ser adicionadas a este arquivo, e qualquer inconsistência encontrada entre documentos deve continuar sendo registrada e corrigida, como já ocorreu ao longo desta série.
