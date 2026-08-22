import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistoricoConvite = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoConviteStatus = 'loading' | 'ready' | 'error';

export function useHistoricoConvite(conviteId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistoricoConvite[]>([]);
  const [status, setStatus] = useState<HistoricoConviteStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !conviteId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('dados->>convite_id', conviteId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistoricoConvite[]);
    setStatus('ready');
  }, [usuario?.id, conviteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
