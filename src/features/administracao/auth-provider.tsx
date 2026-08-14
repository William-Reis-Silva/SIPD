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
  ativo: boolean;
  perfil: Perfil;
};

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  usuario: Usuario | null;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_AUTH_ERROR = 'Não foi possível autenticar. Verifique seu e-mail e senha.';
const NETWORK_ERROR = 'Não foi possível concluir a autenticação no momento. Tente novamente.';

async function fetchUsuario(userId: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, congregacao_id, perfil_id, nome, sobrenome, email, ativo, perfil:perfis(id, nome, descricao)')
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

      if (!nextUsuario || !nextUsuario.ativo) {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUsuario(null);
          setStatus('unauthenticated');
        }
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

      // Checked here (not just in the onAuthStateChange listener below) so an
      // inactive account (FA-02) surfaces its error on the login screen itself,
      // instead of silently bouncing back to login with no message.
      const nextUsuario = await fetchUsuario(data.session.user.id);
      if (!nextUsuario || !nextUsuario.ativo) {
        await supabase.auth.signOut();
        return { error: GENERIC_AUTH_ERROR };
      }

      return { error: null };
    } catch {
      return { error: NETWORK_ERROR };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, usuario, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
