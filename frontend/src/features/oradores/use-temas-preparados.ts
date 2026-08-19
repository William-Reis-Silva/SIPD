import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type TemaPreparado = {
  id: string;
  tema_id: string;
  observacoes: string | null;
  tema: { id: string; numero: string; titulo: string };
};

export type TemasPreparadosStatus = 'loading' | 'ready' | 'error';

const TEMAS_PREPARADOS_SELECT = 'id, tema_id, observacoes, tema:temas(id, numero, titulo)';
const UNIQUE_VIOLATION = '23505';
const ERRO_TEMA_DUPLICADO = 'Esse tema já está entre os preparados do orador.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useTemasPreparados(oradorId: string) {
  const { usuario } = useAuth();
  const [temasPreparados, setTemasPreparados] = useState<TemaPreparado[]>([]);
  const [status, setStatus] = useState<TemasPreparadosStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !oradorId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('temas_preparados')
      .select(TEMAS_PREPARADOS_SELECT)
      .eq('orador_id', oradorId)
      .order('criado_em');

    if (error) {
      setStatus('error');
      return;
    }

    setTemasPreparados((data ?? []) as unknown as TemaPreparado[]);
    setStatus('ready');
  }, [usuario?.id, oradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionarTemaPreparado(temaId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas_preparados')
      .insert({ orador_id: oradorId, tema_id: temaId });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_TEMA_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarObservacoes(
    temaPreparado: TemaPreparado,
    observacoes: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas_preparados')
      .update({ observacoes: observacoes || null })
      .eq('id', temaPreparado.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_preparado_editado',
      descricao: 'Observações do tema preparado editadas',
      dados: {
        orador_id: oradorId,
        tema_preparado_id: temaPreparado.id,
        tema_id: temaPreparado.tema_id,
        observacoes_anteriores: temaPreparado.observacoes,
        observacoes_novas: observacoes,
      },
    });

    await carregar();
    return { error: null };
  }

  async function removerTemaPreparado(temaPreparado: TemaPreparado): Promise<{ error: string | null }> {
    const { error } = await supabase.from('temas_preparados').delete().eq('id', temaPreparado.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_preparado_removido',
      descricao: 'Tema preparado removido',
      dados: { orador_id: oradorId, tema_id: temaPreparado.tema_id },
    });

    await carregar();
    return { error: null };
  }

  return { status, temasPreparados, adicionarTemaPreparado, editarObservacoes, removerTemaPreparado };
}
