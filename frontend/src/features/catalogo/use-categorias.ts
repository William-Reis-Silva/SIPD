import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type CategoriasStatus = 'loading' | 'ready' | 'error';

const CATEGORIAS_SELECT = 'id, nome, descricao, ativo';
const ERRO_NOME_DUPLICADO = 'Já existe uma categoria com esse nome.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

export function useCategorias() {
  const { usuario } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [status, setStatus] = useState<CategoriasStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('categorias')
      .select(CATEGORIAS_SELECT)
      .order('nome');

    if (error) {
      setStatus('error');
      return;
    }

    setCategorias((data ?? []) as Categoria[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarCategoria(nome: string, descricao: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('categorias').insert({ nome, descricao: descricao || null });

    if (error) {
      if (error.code === '23505') return { error: ERRO_NOME_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await carregar();
    return { error: null };
  }

  async function editarCategoria(
    categoria: Categoria,
    dados: { nome: string; descricao: string; ativo: boolean }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('categorias')
      .update({ nome: dados.nome, descricao: dados.descricao || null, ativo: dados.ativo })
      .eq('id', categoria.id);

    if (error) {
      if (error.code === '23505') return { error: ERRO_NOME_DUPLICADO };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'categoria_editada',
      descricao: 'Categoria editada',
      dados: {
        categoria_id: categoria.id,
        nome_anterior: categoria.nome,
        nome_novo: dados.nome,
        ativo_anterior: categoria.ativo,
        ativo_novo: dados.ativo,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, categorias, criarCategoria, editarCategoria };
}
