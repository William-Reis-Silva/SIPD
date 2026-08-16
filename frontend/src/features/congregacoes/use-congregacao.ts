import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Cidade = {
  id: string;
  nome: string;
  estado_id: string;
};

export type Congregacao = {
  id: string;
  numero: string;
  nome: string;
  cidade_id: string;
  cidade: Cidade;
};

export type CongregacaoStatus = 'loading' | 'ready' | 'error';

type AtualizarInput = {
  nome: string;
  numero: string;
  cidade_id: string;
};

const CONGREGACAO_SELECT = 'id, numero, nome, cidade_id, cidade:cidades(id, nome, estado_id)';
const UNIQUE_VIOLATION = '23505';
const ERRO_NUMERO_DUPLICADO = 'Esse número já está em uso por outra congregação.';
const ERRO_SALVAR = 'Não foi possível salvar as alterações. Tente novamente.';

export function useCongregacao() {
  const { usuario } = useAuth();
  const [congregacao, setCongregacao] = useState<Congregacao | null>(null);
  const [status, setStatus] = useState<CongregacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('congregacoes')
      .select(CONGREGACAO_SELECT)
      .eq('id', usuario.congregacao_id)
      .single();

    if (error || !data) {
      setStatus('error');
      return;
    }

    setCongregacao(data as unknown as Congregacao);
    setStatus('ready');
  }, [usuario?.congregacao_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(input: AtualizarInput): Promise<{ error: string | null }> {
    if (!congregacao) return { error: ERRO_SALVAR };

    const { data, error } = await supabase
      .from('congregacoes')
      .update(input)
      .eq('id', congregacao.id)
      .select(CONGREGACAO_SELECT)
      .single();

    if (error) {
      return { error: error.code === UNIQUE_VIOLATION ? ERRO_NUMERO_DUPLICADO : ERRO_SALVAR };
    }
    if (!data) {
      return { error: ERRO_SALVAR };
    }

    setCongregacao(data as unknown as Congregacao);
    return { error: null };
  }

  return { status, congregacao, atualizar };
}
