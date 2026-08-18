import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type ConviteUsuario = {
  id: string;
  perfil_id: string;
  codigo: string;
  rotulo: string | null;
  expira_em: string;
  perfil: { id: string; nome: string };
};

export type ConvitesUsuarioStatus = 'loading' | 'ready' | 'error';

const CONVITES_SELECT = 'id, perfil_id, codigo, rotulo, expira_em, perfil:perfis(id, nome)';
const ERRO_CRIAR_CONVITE = 'Não foi possível criar o convite. Tente novamente.';
const ERRO_CANCELAR_CONVITE = 'Não foi possível cancelar o convite. Tente novamente.';
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para convidar usuários.';
const ERRO_PERFIL_ADMIN = 'Apenas o Administrador Global pode atribuir esse perfil.';
const ERRO_PERFIL_INVALIDO = 'Não foi possível encontrar esse perfil. Tente novamente.';

export function useConvitesUsuario() {
  const { usuario } = useAuth();
  const [convites, setConvites] = useState<ConviteUsuario[]>([]);
  const [status, setStatus] = useState<ConvitesUsuarioStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('convites_usuario')
      .select(CONVITES_SELECT)
      .eq('status', 'Pendente')
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setConvites((data ?? []) as unknown as ConviteUsuario[]);
    setStatus('ready');
  }, [usuario?.congregacao_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarConvite(perfilId: string, rotulo: string): Promise<{ codigo: string | null; error: string | null }> {
    const { data, error } = await supabase.rpc('criar_convite_usuario', {
      p_perfil_id: perfilId,
      p_rotulo: rotulo || null,
    });

    if (error) {
      if (error.message.includes('sem_permissao_perfil_admin')) return { codigo: null, error: ERRO_PERFIL_ADMIN };
      if (error.message.includes('sem_permissao')) return { codigo: null, error: ERRO_SEM_PERMISSAO };
      if (error.message.includes('perfil_invalido')) return { codigo: null, error: ERRO_PERFIL_INVALIDO };
      return { codigo: null, error: ERRO_CRIAR_CONVITE };
    }
    if (!data || !data[0]) return { codigo: null, error: ERRO_CRIAR_CONVITE };

    await carregar();
    return { codigo: (data[0] as { codigo: string }).codigo, error: null };
  }

  async function cancelarConvite(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('cancelar_convite_usuario', { p_convite_id: id });
    if (error) return { error: ERRO_CANCELAR_CONVITE };

    await carregar();
    return { error: null };
  }

  return { status, convites, criarConvite, cancelarConvite };
}
