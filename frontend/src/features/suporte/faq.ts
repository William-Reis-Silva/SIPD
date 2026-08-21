export type PerguntaFrequente = {
  id: string;
  pergunta: string;
  resposta: string;
};

export const PERGUNTAS_FREQUENTES: PerguntaFrequente[] = [
  {
    id: 'esqueci-senha',
    pergunta: 'Esqueci minha senha, o que eu faço?',
    resposta:
      'Ainda não há recuperação de senha automática pelo app. Envie uma mensagem de suporte pedindo redefinição, informando seu e-mail cadastrado, que o Administrador Global providencia.',
  },
  {
    id: 'criar-conta',
    pergunta: 'Como eu crio minha conta?',
    resposta:
      'Você precisa de um código de convite enviado por um Coordenador ou Administrador Global da sua congregação. Na tela de login, toque em "Tenho um código de convite" e preencha seus dados.',
  },
  {
    id: 'cadastrar-congregacao',
    pergunta: 'Como cadastro uma nova congregação?',
    resposta:
      'Na aba Congregação, preencha nome, número e escolha estado e cidade. Se a cidade não existir na lista, digite o nome dela no campo de busca e toque em "Cadastrar cidade" para criá-la.',
  },
  {
    id: 'convidar-usuario',
    pergunta: 'Como convido alguém para usar o sistema?',
    resposta:
      'Na aba Usuários, se você for Coordenador ou Administrador Global, use "Convites pendentes" para gerar um código, escolhendo o perfil (Editor, Leitor, etc.) da pessoa. Compartilhe o código ou o link gerado com ela.',
  },
  {
    id: 'perfis-permissoes',
    pergunta: 'Qual a diferença entre os perfis de usuário?',
    resposta:
      'Administrador Global tem acesso irrestrito a tudo. Coordenador administra tudo dentro da própria congregação. Editor faz o dia a dia (cadastra oradores, programações, convites). Leitor só consulta, sem editar nada.',
  },
  {
    id: 'cadastrar-tema',
    pergunta: 'Como cadastro um tema novo no catálogo?',
    resposta:
      'Só o Administrador Global pode cadastrar temas e categorias. Na aba Temas, toque em "Novo Tema" e preencha número, título e categoria.',
  },
  {
    id: 'cadastrar-orador',
    pergunta: 'Como cadastro um orador?',
    resposta:
      'Na aba Oradores, toque em "Novo Orador" e preencha nome, telefone, cidade e a congregação de origem dele. O telefone precisa ser único no sistema.',
  },
  {
    id: 'temas-preparados',
    pergunta: 'Como registro os temas que um orador já discursa?',
    resposta:
      'Abra o orador na aba Oradores, vá em "Temas Preparados" e toque em "Adicionar Tema" para buscar e vincular um tema do catálogo a ele.',
  },
];
