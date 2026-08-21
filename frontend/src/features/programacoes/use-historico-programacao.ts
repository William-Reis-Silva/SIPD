import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistoricoProgramacao = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoProgramacaoStatus = 'loading' | 'ready' | 'error';

export function useHistoricoProgramacao(programacaoId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistoricoProgramacao[]>([]);
  const [status, setStatus] = useState<HistoricoProgramacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !programacaoId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('programacao_id', programacaoId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistoricoProgramacao[]);
    setStatus('ready');
  }, [usuario?.id, programacaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
