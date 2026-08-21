import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type MensagemSuporte = {
  id: string;
  usuario_id: string;
  assunto: string;
  mensagem: string;
  status: 'Aberto' | 'Respondido';
  resposta: string | null;
  respondido_por: string | null;
  respondido_em: string | null;
  criado_em: string;
  usuario: { nome: string; sobrenome: string } | null;
};

export type SuporteStatus = 'loading' | 'ready' | 'error';

const SUPORTE_SELECT =
  'id, usuario_id, assunto, mensagem, status, resposta, respondido_por, respondido_em, criado_em, ' +
  'usuario:usuarios!usuario_id(nome, sobrenome)';
const ERRO_ENVIAR = 'Não foi possível enviar sua mensagem. Tente novamente.';
const ERRO_RESPONDER = 'Não foi possível enviar a resposta. Tente novamente.';

export function useSuporte() {
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [status, setStatus] = useState<SuporteStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('suporte_mensagens')
      .select(SUPORTE_SELECT)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setMensagens((data ?? []) as unknown as MensagemSuporte[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarMensagem(assunto: string, mensagem: string): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_ENVIAR };

    const { error } = await supabase
      .from('suporte_mensagens')
      .insert({ usuario_id: usuario.id, assunto, mensagem });

    if (error) return { error: ERRO_ENVIAR };

    await carregar();
    return { error: null };
  }

  async function responder(mensagemId: string, resposta: string): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_RESPONDER };

    const { error } = await supabase
      .from('suporte_mensagens')
      .update({
        resposta,
        status: 'Respondido',
        respondido_por: usuario.id,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', mensagemId);

    if (error) return { error: ERRO_RESPONDER };

    await carregar();
    return { error: null };
  }

  return { status, mensagens, criarMensagem, responder };
}
