import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Perfil = {
  id: string;
  nome: string;
};

export type UsuarioCongregacao = {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  perfil_id: string;
  perfil: Perfil;
};

export type UsuariosCongregacaoStatus = 'loading' | 'ready' | 'error';

const USUARIOS_SELECT = 'id, nome, sobrenome, email, telefone, ativo, perfil_id, perfil:perfis(id, nome)';
const ERRO_ATUALIZAR = 'Não foi possível salvar a alteração. Tente novamente.';

export function useUsuariosCongregacao() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioCongregacao[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [status, setStatus] = useState<UsuariosCongregacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const [usuariosResult, perfisResult] = await Promise.all([
      supabase
        .from('usuarios')
        .select(USUARIOS_SELECT)
        .eq('congregacao_id', usuario.congregacao_id)
        .order('nome'),
      supabase.from('perfis').select('id, nome').order('nome'),
    ]);

    if (usuariosResult.error || perfisResult.error) {
      setStatus('error');
      return;
    }

    setUsuarios((usuariosResult.data ?? []) as unknown as UsuarioCongregacao[]);
    setPerfis((perfisResult.data ?? []) as Perfil[]);
    setStatus('ready');
  }, [usuario?.congregacao_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizarPerfil(alvo: UsuarioCongregacao, perfilId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('usuarios').update({ perfil_id: perfilId }).eq('id', alvo.id);
    if (error) return { error: ERRO_ATUALIZAR };

    await supabase.from('historicos').insert({
      usuario_id: alvo.id,
      tipo: 'usuario_perfil_alterado',
      descricao: 'Perfil do usuário alterado',
      dados: { perfil_anterior_id: alvo.perfil_id, perfil_novo_id: perfilId },
    });

    await carregar();
    return { error: null };
  }

  async function alternarAtivo(alvo: UsuarioCongregacao, ativo: boolean): Promise<{ error: string | null }> {
    const { error } = await supabase.from('usuarios').update({ ativo }).eq('id', alvo.id);
    if (error) return { error: ERRO_ATUALIZAR };

    await supabase.from('historicos').insert({
      usuario_id: alvo.id,
      tipo: ativo ? 'usuario_ativado' : 'usuario_desativado',
      descricao: ativo ? 'Usuário ativado' : 'Usuário desativado',
      dados: { ativo_anterior: alvo.ativo, ativo_novo: ativo },
    });

    await carregar();
    return { error: null };
  }

  return { status, usuarios, perfis, atualizarPerfil, alternarAtivo };
}
