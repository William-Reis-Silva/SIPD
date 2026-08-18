import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Tema = {
  id: string;
  numero: string;
  titulo: string;
  ativo: boolean;
  categoria_id: string;
  categoria: { id: string; nome: string };
};

export type TemasStatus = 'loading' | 'ready' | 'error';

const TEMAS_SELECT = 'id, numero, titulo, ativo, categoria_id, categoria:categorias(id, nome)';
const ERRO_NUMERO_DUPLICADO = 'Já existe um tema com esse número.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useTemas() {
  const { usuario } = useAuth();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [status, setStatus] = useState<TemasStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase.from('temas').select(TEMAS_SELECT).order('numero');

    if (error) {
      setStatus('error');
      return;
    }

    setTemas((data ?? []) as unknown as Tema[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarTema(numero: string, titulo: string, categoriaId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas')
      .insert({ numero, titulo, categoria_id: categoriaId });

    if (error) {
      if (error.code === '23505') return { error: ERRO_NUMERO_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarTema(
    tema: Tema,
    dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('temas')
      .update({
        numero: dados.numero,
        titulo: dados.titulo,
        categoria_id: dados.categoriaId,
        ativo: dados.ativo,
      })
      .eq('id', tema.id);

    if (error) {
      if (error.code === '23505') return { error: ERRO_NUMERO_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'tema_editado',
      descricao: 'Tema editado',
      dados: {
        tema_id: tema.id,
        numero_anterior: tema.numero,
        numero_novo: dados.numero,
        categoria_anterior_id: tema.categoria_id,
        categoria_nova_id: dados.categoriaId,
        ativo_anterior: tema.ativo,
        ativo_novo: dados.ativo,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, temas, criarTema, editarTema };
}
