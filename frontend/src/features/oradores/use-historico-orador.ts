import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistorico = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoOradorStatus = 'loading' | 'ready' | 'error';

export function useHistoricoOrador(oradorId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [status, setStatus] = useState<HistoricoOradorStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !oradorId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('dados->>orador_id', oradorId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistorico[]);
    setStatus('ready');
  }, [usuario?.id, oradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
