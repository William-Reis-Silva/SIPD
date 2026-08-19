# Roteiro de Teste Manual — Oradores (Cadastro e Consulta)

Este roteiro cobre a parte de interação via navegador da verificação end-to-end
da Task 9. As verificações que dependiam de SQL direto (constraint de telefone
único, trigger de trava de origem, RLS de `historicos`, ausência de policy de
DELETE em `oradores`) já foram executadas e confirmadas via `execute_sql`
durante a execução do plano (ver commit `868746f`'s SDD ledger) — não é
preciso repeti-las aqui.

## Pré-requisito

1. Em `frontend/`, rode `npm run web`.
2. Aguarde a mensagem `Web Bundled` no terminal (ou aguarde a página carregar).
3. Abra `http://localhost:8081` no navegador.
4. Abra o console do navegador (F12 → aba "Console") e deixe-o visível durante
   todo o roteiro, para observar a checagem do Passo 12.

Você vai precisar de pelo menos duas contas de teste com perfis diferentes:
uma **Administrador Global** e pelo menos uma conta **não-AG** (Coordenador,
Editor ou Leitor — idealmente teste com um Leitor à parte, pois ele tem o
gating de permissão mais restrito).

---

## Bloco 1 — Navegação básica

- [ ] **1.** Faça login como Administrador Global.
- [ ] **2.** Confirme que uma nova aba "Oradores" aparece na barra de abas.
- [ ] **3.** Toque na aba "Oradores" → confirme que abre em `/oradores` com a
      lista vazia (ou com os oradores já cadastrados, se houver).
- [ ] **4.** Toque em "Novo Orador" → confirme que navega para `/oradores/novo`
      permanecendo na aba Oradores (sem "piscar" para outra aba na barra).

## Bloco 2 — Cadastro, caminho feliz

- [ ] **5.** Em `/oradores/novo`, preencha:
      - Nome
      - Sobrenome
      - Telefone (ex.: `(11) 99999-1111`)
      - Estado / Cidade
      - Congregação de origem
      Toque em "Salvar Orador".
- [ ] **6.** Confirme que a tela redireciona para `/oradores/<id>` mostrando:
      - Os dados do orador recém-criado.
      - O telefone formatado como `(11) 99999-1111`.
      - O rótulo "Sem conta vinculada".
- [ ] **7.** Toque em "‹ Voltar" (ou navegue de volta para `/oradores`) →
      confirme que o novo orador aparece na lista.

## Bloco 3 — Duplicidade e validação

- [ ] **8.** Tente cadastrar outro orador com o **mesmo telefone** do Bloco 2 →
      confirme a mensagem "Já existe um orador com esse telefone." e que
      nenhum orador duplicado foi criado.
- [ ] **9.** Tente cadastrar um orador com telefone inválido (ex.: `123`) →
      confirme a mensagem "Informe um telefone válido, com DDD." e que a
      mensagem aparece **sem** demora perceptível de rede (validação client-side,
      sem round-trip ao servidor).

## Bloco 4 — Editar dados e trava de origem

- [ ] **10.** Abra o orador criado no Bloco 2, toque em "Editar" → altere o
      nome e o telefone → "Salvar" → confirme que os novos dados aparecem na
      tela de detalhe.
- [ ] **11.** Ainda como Administrador Global (ou como Coordenador/Editor, se
      disponível), tente alterar a "Congregação de origem" desse mesmo orador
      (agora com um dropdown dedicado no formulário de edição) → confirme que
      a alteração é permitida (o orador ainda não tem conta vinculada nesse
      ponto do roteiro).

> A partir daqui, um `usuario_id` será vinculado ao orador via SQL direto.
> Peça para alguém com acesso ao projeto Supabase (`imeoyetcbjlkrxubwldv`)
> rodar `update public.oradores set usuario_id = '<uuid-de-um-usuario>' where
> id = '<id-do-orador-de-teste>';`, ou repita o cadastro de um orador
> específico para este teste manual e peça para vincular via SQL antes de
> continuar.

- [ ] **12.** Com o orador já vinculado a uma conta de usuário, faça login como
      Coordenador ou Editor (que **não** seja o usuário vinculado ao orador) e
      tente alterar a Congregação de origem novamente → confirme a mensagem
      "Apenas o próprio orador vinculado pode alterar a congregação de
      origem."
- [ ] **13.** Faça login como Administrador Global e tente a mesma alteração →
      confirme que é permitida (AG sempre pode alterar, independentemente do
      vínculo).

## Bloco 5 — Temas Preparados

- [ ] **14.** Na tela de detalhe do orador, mude para a aba "Temas
      Preparados" → "Adicionar Tema" → escolha um tema → confirme que ele
      aparece na lista.
- [ ] **15.** Edite o campo "Observações" desse tema → "Salvar observações" →
      recarregue a tela e confirme que a observação persistiu.
- [ ] **16.** Toque em "Remover" nesse tema → confirme que ele desaparece da
      lista de Temas Preparados.
- [ ] **17.** Adicione o mesmo tema novamente e, em seguida, abra o seletor
      "Selecionar tema" → confirme que temas já adicionados **não** aparecem
      mais como opção no dropdown (evita duplicidade).

## Bloco 6 — Histórico e permissão de consulta

- [ ] **18.** Na tela de detalhe do orador, mude para a aba "Histórico" →
      confirme que os eventos de criação, edição e alterações de tema
      preparado dos blocos anteriores aparecem, do mais recente para o mais
      antigo.
- [ ] **19.** Faça login como Leitor (ou Editor/Coordenador) → abra o mesmo
      orador → aba "Histórico" → confirme que os eventos continuam visíveis
      (esse é o comportamento corrigido: antes, só o Administrador Global
      conseguia ver o histórico).
- [ ] **20.** Ainda como esse usuário não-Administrador-Global, confirme:
      - Na lista `/oradores`: o botão "Novo Orador" **não** aparece para
        Leitor (mas aparece para Coordenador/Editor).
      - No detalhe do orador, abas "Dados" e "Temas Preparados": os controles
        "Editar" / "Adicionar Tema" / "Remover" **não** aparecem para Leitor,
        mas **aparecem** para Coordenador/Editor.

## Bloco 7 — Busca e filtro por tema

- [ ] **21.** Em `/oradores`, digite parte de um nome na caixa de busca →
      confirme que a lista filtra corretamente.
- [ ] **22.** Limpe a busca e digite parte de um telefone → confirme que a
      lista também filtra corretamente por telefone.
- [ ] **23.** Selecione um tema específico em "Filtrar por tema" → confirme
      que só aparecem oradores que têm aquele tema como preparado.
- [ ] **24.** Selecione "Todos os temas" novamente → confirme que a lista
      completa volta a aparecer.

## Bloco 8 — Console do navegador

- [ ] **25.** Revise o console do navegador (aberto desde o início do
      roteiro) → confirme que nenhum erro inesperado foi registrado durante
      os blocos 1 a 7 (avisos de depreciação conhecidos, como o de
      `shadow*` styles do React Native Web, não contam como erro).

---

## Ao terminar

Depois de concluir o roteiro, você pode encerrar o servidor de desenvolvimento
(`Ctrl+C` no terminal onde rodou `npm run web`, ou feche o terminal).

Se algum passo falhar, anote: o número do passo, o que era esperado, o que
aconteceu de fato, e (se possível) qualquer mensagem de erro exibida na tela
ou no console do navegador.
