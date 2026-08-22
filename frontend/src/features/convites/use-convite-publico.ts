import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type TemaDisponivel = { tema_id: string; numero: string; titulo: string };

export type ConvitePublico = {
  status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado';
  orador_nome: string;
  congregacao_nome: string;
  datas_candidatas: string[];
  temas_disponiveis: TemaDisponivel[] | null;
  confirmacao_pendente: boolean;
};

export type ConvitePublicoStatus = 'loading' | 'ready' | 'error';

const ERRO_GENERICO = 'Não foi possível enviar sua resposta. Tente novamente.';
const ERRO_CONVITE_INVALIDO = 'Este link de convite não é válido.';
const ERRO_CONVITE_EXPIRADO = 'Este convite expirou. Peça à congregação um novo link.';
const ERRO_TEMA_INDISPONIVEL = 'Este tema não está mais disponível. Escolha outro.';
const ERRO_DATA_INDISPONIVEL = 'Esta data não está mais disponível. Escolha outra.';
const ERRO_CONFIRMACAO_ENVIADA = 'A confirmação para este convite já foi enviada.';
const ERRO_PERMANENCIA = 'É necessário confirmar que permanecerá até o final da reunião.';

function mapearErroRpc(mensagem: string): string {
  if (mensagem.includes('convite_invalido')) return ERRO_CONVITE_INVALIDO;
  if (mensagem.includes('convite_expirado')) return ERRO_CONVITE_EXPIRADO;
  if (mensagem.includes('tema_invalido') || mensagem.includes('tema_indisponivel')) return ERRO_TEMA_INDISPONIVEL;
  if (mensagem.includes('data_invalida') || mensagem.includes('data_indisponivel')) return ERRO_DATA_INDISPONIVEL;
  if (mensagem.includes('confirmacao_ja_enviada')) return ERRO_CONFIRMACAO_ENVIADA;
  if (mensagem.includes('permanencia_obrigatoria')) return ERRO_PERMANENCIA;
  return ERRO_GENERICO;
}

export function useConvitePublico(token: string) {
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [status, setStatus] = useState<ConvitePublicoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!token) return;

    setStatus('loading');
    const { data, error } = await supabase.rpc('consultar_convite_publico', { p_token: token });

    if (error || !data) {
      setStatus('error');
      return;
    }

    setConvite(data as unknown as ConvitePublico);
    setStatus('ready');
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responderConvite(
    input: { recusar: true } | { recusar: false; data: string; temaId: string }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('responder_convite_publico', {
      p_token: token,
      p_recusar: input.recusar,
      p_data: input.recusar ? null : input.data,
      p_tema_id: input.recusar ? null : input.temaId,
    });

    if (error) return { error: mapearErroRpc(error.message) };
    await carregar();
    return { error: null };
  }

  async function enviarConfirmacao(input: {
    canticoInicial: string;
    utilizaraImagens: boolean;
    permanecereAteFinal: boolean;
    observacoes: string;
    anexos: { caminho: string; nome_arquivo: string }[];
  }): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('enviar_confirmacao_convite_publico', {
      p_token: token,
      p_cantico_inicial: input.canticoInicial || null,
      p_utilizara_imagens: input.utilizaraImagens,
      p_permanecera_ate_final: input.permanecereAteFinal,
      p_observacoes: input.observacoes || null,
      p_anexos: input.anexos,
    });

    if (error) return { error: mapearErroRpc(error.message) };
    await carregar();
    return { error: null };
  }

  async function uploadAnexo(arquivo: File): Promise<{ error: string | null; caminho: string | null }> {
    const caminho = `${token}/${Date.now()}_${arquivo.name}`;
    const { error } = await supabase.storage.from('convite-anexos').upload(caminho, arquivo);

    if (error) return { error: ERRO_GENERICO, caminho: null };
    return { error: null, caminho };
  }

  return { status, convite, responderConvite, enviarConfirmacao, uploadAnexo };
}
