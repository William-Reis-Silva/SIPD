import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type Perfil = {
  id: string;
  nome: string;
  descricao: string | null;
};

export type Usuario = {
  id: string;
  congregacao_id: string;
  perfil_id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  perfil: Perfil;
};

export type AuthStatus = 'loading' | 'authenticated' | 'onboarding' | 'unauthenticated';

export type CompletarCadastroInput = {
  nomeCongregacao: string;
  numero: string;
  cidadeId: string;
  nomeUsuario: string;
  sobrenomeUsuario: string;
  telefone: string;
};

export type AuthContextValue = {
  status: AuthStatus;
  usuario: Usuario | null;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signUp: (email: string, senha: string) => Promise<{ error: string | null }>;
  completarCadastro: (input: CompletarCadastroInput) => Promise<{ error: string | null }>;
  aceitarConvite: (
    codigo: string,
    nome: string,
    sobrenome: string,
    telefone: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_AUTH_ERROR = 'Não foi possível autenticar. Verifique seu e-mail e senha.';
const NETWORK_ERROR = 'Não foi possível concluir a autenticação no momento. Tente novamente.';
const ERRO_EMAIL_EM_USO = 'Esse e-mail já está em uso. Tente entrar na sua conta.';
const ERRO_SENHA_CURTA = 'A senha precisa ter pelo menos 6 caracteres.';
const ERRO_SIGNUP_GENERICO = 'Não foi possível criar a conta. Tente novamente.';
const ERRO_NUMERO_DUPLICADO =
  'Já existe uma congregação com esse número. Peça para o Coordenador dela te convidar.';
const ERRO_CADASTRO_GENERICO = 'Não foi possível concluir o cadastro. Tente novamente.';
const ERRO_CONVITE_INVALIDO = 'Código de convite inválido. Confira e tente novamente.';
const ERRO_CONVITE_EXPIRADO = 'Esse convite expirou. Peça um novo código.';
const ERRO_UNICO_COORDENADOR =
  'Você é o único Coordenador da sua congregação atual. Atribua o cargo a outro usuário antes de aceitar este convite.';
const ERRO_CONVITE_GENERICO = 'Não foi possível concluir a operação. Tente novamente.';

async function fetchUsuario(userId: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, congregacao_id, perfil_id, nome, sobrenome, email, telefone, ativo, perfil:perfis(id, nome, descricao)')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as unknown as Usuario;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function syncFromSession(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
        return;
      }

      const nextUsuario = await fetchUsuario(session.user.id);
      if (cancelled) return;

      if (nextUsuario && !nextUsuario.ativo) {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
        return;
      }

      if (!nextUsuario) {
        // Sessão válida, mas sem linha em `usuarios` ainda — conta recém-criada
        // via signUp, aguardando o fluxo de Completar Cadastro (ou Aceitar Convite).
        setUsuario(null);
        setStatus('onboarding');
        return;
      }

      setUsuario(nextUsuario);
      setStatus('authenticated');
    }

    supabase.auth.getSession().then(({ data }) => syncFromSession(data.session));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, senha: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error || !data.session) return { error: GENERIC_AUTH_ERROR };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (nextUsuario && !nextUsuario.ativo) {
        await supabase.auth.signOut();
        return { error: GENERIC_AUTH_ERROR };
      }

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signUp(email: string, senha: string): Promise<{ error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered')) return { error: ERRO_EMAIL_EM_USO };
        if (msg.includes('password')) return { error: ERRO_SENHA_CURTA };
        return { error: ERRO_SIGNUP_GENERICO };
      }
      if (!data.session) return { error: ERRO_SIGNUP_GENERICO };

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function completarCadastro(input: CompletarCadastroInput): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('completar_cadastro_congregacao', {
        p_nome_congregacao: input.nomeCongregacao,
        p_numero: input.numero,
        p_cidade_id: input.cidadeId,
        p_nome_usuario: input.nomeUsuario,
        p_sobrenome_usuario: input.sobrenomeUsuario,
        p_telefone: input.telefone,
      });

      if (error) {
        if (error.message.includes('numero_duplicado')) {
          return { error: ERRO_NUMERO_DUPLICADO };
        }
        if (!error.message.includes('usuário já possui cadastro completo')) {
          return { error: ERRO_CADASTRO_GENERICO };
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) return { error: ERRO_CADASTRO_GENERICO };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario) return { error: ERRO_CADASTRO_GENERICO };

      setUsuario(nextUsuario);
      setStatus('authenticated');
      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function aceitarConvite(
    codigo: string,
    nome: string,
    sobrenome: string,
    telefone: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('aceitar_convite_usuario', {
        p_codigo: codigo,
        p_nome: nome,
        p_sobrenome: sobrenome,
        p_telefone: telefone,
      });

      if (error) {
        if (error.message.includes('convite_expirado')) return { error: ERRO_CONVITE_EXPIRADO };
        if (error.message.includes('convite_invalido')) return { error: ERRO_CONVITE_INVALIDO };
        if (error.message.includes('unico_coordenador')) return { error: ERRO_UNICO_COORDENADOR };
        return { error: ERRO_CONVITE_GENERICO };
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) return { error: ERRO_CONVITE_GENERICO };

      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario) return { error: ERRO_CONVITE_GENERICO };

      setUsuario(nextUsuario);
      setStatus('authenticated');
      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ status, usuario, signIn, signUp, completarCadastro, aceitarConvite, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
