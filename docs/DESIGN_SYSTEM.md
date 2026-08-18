# DESIGN_SYSTEM

> Sistema Inteligente de Programação de Discursos (SIPD)

**Versão:** 1.0
**Data:** 2026-08-18

---

## Objetivo

Este documento congela as decisões de identidade visual do SIPD — cores, assets de ícone, e convenções de layout para desktop/PWA — para que cada tela nova siga o mesmo padrão em vez de reinventar (o "cada programador escolheu seu próprio azul").

Fonte da proposta original de paleta: `docs/anexos/styles SIPD.pdf`. Este documento formaliza essa proposta, preenche a lacuna de dark mode (não coberta no PDF) e resolve um problema de contraste encontrado nela (ver "Regra do dourado" abaixo).

---

## Cores

### Tokens de marca (`tailwind.config.js` → `theme.extend.colors.brand`)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `brand-primary` | `#0B3B82` | `#2D6FD6` | Botões principais, menu, cabeçalhos |
| `brand-secondary` | `#1677D2` | `#4FA3F7` | Links, ações secundárias, elementos ativos |
| `brand-light` | `#EAF3FF` | `#12335E` | Fundos, cards selecionados, áreas informativas |
| `brand-deep` | `#06265A` | `#DCE9FB` | Texto forte, sidebar, contraste |
| `brand-gold` | `#D9A62E` | `#E8C158` | Destaques, confirmações especiais |
| `brand-gold-light` | `#FFF4D6` | `#3A2E10` | Fundo de avisos/destaques |

### Tokens semânticos (`theme.extend.colors.semantic`)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `semantic-success` | `#16A34A` | `#22C55E` | Aceito, confirmado, realizado |
| `semantic-warning` | `#D97706` | `#F59E0B` | Pendências, alertas |
| `semantic-error` | `#DC2626` | `#EF4444` | Bloqueios, erros, recusas |
| `semantic-info` | `#2563EB` | `#3B82F6` | Informações e notificações |

### Como usar

Este projeto **não usa CSS variables para tema** — o padrão já estabelecido em todo o app (`bg-white dark:bg-neutral-900`) é declarar explicitamente a classe clara e a escura lado a lado. Os tokens de marca seguem o mesmo padrão:

```tsx
<View className="bg-brand-primary dark:bg-brand-primary-dark">
```

Os cinzas/neutros continuam vindo da escala padrão do Tailwind (`neutral-*`), como já é feito em todas as telas — os tokens de marca/semânticos são um acréscimo, não uma substituição.

`frontend/src/constants/theme.ts` espelha os tokens claros/escuros usados acima para os poucos lugares que precisam de cor via prop JS em vez de `className` (ex.: `Dropdown` do `react-native-element-dropdown`, cores da barra de abas).

### Proporção de uso

Seguir a proporção da proposta original: **60% neutro, 30% azul, 10% dourado**. O dourado nunca deve dominar a interface — funciona como cor de destaque pontual (confirmações especiais, indicadores de inteligência/sugestão), não como cor de fundo ou de botão comum.

### Regra do dourado (achado durante a implementação)

O PDF original sugeria texto branco sobre fundo dourado. **Isso falha contraste WCAG AA** — branco sobre `#D9A62E` dá ~2,2:1 (mínimo exigido é 4,5:1 para texto normal, 3:1 para texto grande/UI). Qualquer botão, badge ou destaque com fundo `brand-gold`/`brand-gold-dark` deve usar texto escuro (`brand-deep` ou `neutral-900`), nunca branco — testado em ~6,6:1, dentro do padrão AA com folga.

---

## Ícones e Assets

Os arquivos-fonte (`logo.png`, `favicon.png` — 1254×1254) continham a marca completa mais próxima da borda do que o recomendado, o que cortava conteúdo em ícones adaptativos do Android e resultava no ícone padrão do Expo sendo usado no iOS (nunca substituído). Gerados a partir da marca (círculo com pódio/rede/calendário, sem o texto "SIPD") em `frontend/assets/images/`:

| Arquivo | Tamanho | Uso | Nota |
|---|---|---|---|
| `icon-mark.png` | 1024×1024, transparente | `expo.icon` (app.json raiz), imagem da splash screen | Marca isolada, ~92% do canvas |
| `icon-android-adaptive.png` | 1024×1024, transparente | `android.adaptiveIcon.foregroundImage` | Conteúdo em ~66% do canvas (zona de segurança — launchers Android recortam até ~33% das bordas) |
| `icon-ios.png` | 1024×1024, opaco (fundo `#06265A`) | `ios.icon` | iOS aplica sua própria máscara de cantos arredondados — precisa de quadrado opaco sem transparência, cor de fundo até a borda |
| `favicon.png` | 512×512, transparente | `web.favicon` | Substituído — a versão antiga incluía o texto "SIPD" abaixo do círculo, ilegível em 16–32px |

`logo.png` (lockup horizontal completo, ícone + "SIPD" + tagline) continua disponível para uso futuro em contextos com espaço suficiente (ex.: tela de login, cabeçalho de e-mail) — não foi alterado.

Cores atualizadas em `app.json`: `android.adaptiveIcon.backgroundColor` → `#EAF3FF` (brand-light); `expo-splash-screen.backgroundColor` → `#06265A` (brand-deep); `imageWidth` da splash de 76 → 180 (76px tornava qualquer imagem praticamente ilegível).

**Se a marca for atualizada no futuro:** repetir o processo de recorte (identificar a bounding box do ícone sozinho, sem texto, e regenerar as 4 variantes acima com as mesmas proporções de zona de segurança) em vez de só substituir os arquivos originais.

---

## Layout Desktop / PWA

Estado atual do código (verificado, não hipotético):

- `frontend/src/components/app-tabs.web.tsx` já tem um padrão de layout web dedicado (barra de abas horizontal fixa no topo, distinta do `NativeTabs` usado em mobile) com `MaxContentWidth = 800` (`frontend/src/constants/theme.ts`) aplicado ao **container da barra de abas**.
- Telas de formulário estreito (`login.tsx`, `signup.tsx`, `completar-cadastro.tsx`, `aceitar-convite.tsx`, `congregacao.tsx`, `index.tsx`) já usam um wrapper interno `w-full max-w-sm` (384px) — bem abaixo de qualquer largura de desktop, não precisavam de tratamento.
- `temas.tsx` e `usuarios.tsx` (listas com `ScrollView`) não tinham nenhum limite — o conteúdo esticava até a borda da janela em telas largas.

**Convenção aplicada:** o conteúdo do `ScrollView` fica dentro de um `View` com `width: '100%', maxWidth: MaxContentWidth`, e `contentContainerStyle={{ alignItems: 'center' }}` no `ScrollView` centraliza esse container. Aditivo — sem mudança visual em mobile (viewport já é menor que 800px na prática).

Aplicado em `temas.tsx` e `usuarios.tsx`. Se uma tela nova usar o padrão `ScrollView` de lista (em vez do padrão `max-w-sm` de formulário), seguir a mesma convenção.

Breakpoints, grid multi-coluna em desktop, e demais decisões de responsividade (ex.: sidebar fixa vs. barra de abas em telas muito largas) ainda não foram definidos — ficam como próximo assunto quando isso for necessário.

---

## Pendências (fora do escopo desta versão)

Da lista original do PDF, ainda não cobertos: tipografia, espaçamentos (parcialmente já existe em `Spacing` de `theme.ts`), bordas, sombras, especificação de componentes (botões/cards/badges/estados/ícones), regras de uso do logo. Adicionar conforme forem sendo decididos — não adiantar hipoteticamente.
