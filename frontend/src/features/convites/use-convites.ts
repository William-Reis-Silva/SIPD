import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type ConfirmacaoConvite = {
  id: string;
  cantico_inicial: string | null;
  utilizara_imagens: boolean | null;
  permanecera_ate_final: boolean | null;
  observacoes: string | null;
  anexos: { caminho: string; nome_arquivo: string }[];
  enviada_em: string;
};

export type Convite = {
  id: string;
  congregacao_id: string;
  orador_id: string;
  orador: { id: string; nome: string; sobrenome: string };
  programacao_id: string | null;
  status: 'Criado' | 'Enviado' | 'Aceito' | 'Recusado' | 'Cancelado' | 'Expirado';
  token: string;
  expira_em: string;
  enviado_em: string | null;
  respondido_em: string | null;
  cancelado_em: string | null;
  criado_por: string;
  convite_datas: { id: string; data: string }[];
  confirmacoes: ConfirmacaoConvite[];
};

export type ConvitesStatus = 'loading' | 'ready' | 'error';

const CONVITES_SELECT =
  'id, congregacao_id, orador_id, orador:oradores(id, nome, sobrenome), programacao_id, status, token, ' +
  'expira_em, enviado_em, respondido_em, cancelado_em, criado_por, convite_datas(id, data), ' +
  'confirmacoes(id, cantico_inicial, utilizara_imagens, permanecera_ate_final, observacoes, anexos, enviada_em)';

const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';
const ERRO_SEM_DATAS = 'Selecione ao menos uma data candidata.';
const ERRO_DATA_OFERTADA = 'Uma ou mais datas já estão em outro convite aberto.';
const ERRO_JA_FINALIZADO = 'Este convite já foi respondido, cancelado ou expirou.';

export function useConvites() {
  const { usuario } = useAuth();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [status, setStatus] = useState<ConvitesStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('convites')
      .select(CONVITES_SELECT)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setConvites((data ?? []) as unknown as Convite[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarConvite(input: {
    oradorId: string;
    congregacaoId: string;
    datas: string[];
  }): Promise<{ error: string | null; convite: Convite | null }> {
    if (!usuario) return { error: ERRO_SALVAR, convite: null };
    if (input.datas.length === 0) return { error: ERRO_SEM_DATAS, convite: null };

    const { data: conviteCriado, error: conviteError } = await supabase
      .from('convites')
      .insert({ congregacao_id: input.congregacaoId, orador_id: input.oradorId, criado_por: usuario.id })
      .select('id')
      .single();

    if (conviteError || !conviteCriado) return { error: ERRO_SALVAR, convite: null };

    const { error: datasError } = await supabase
      .from('convite_datas')
      .insert(input.datas.map((data) => ({ convite_id: conviteCriado.id, data })));

    if (datasError) {
      // Convite já existe sem nenhuma data candidata — não há policy de DELETE
      // (projeto nunca faz hard delete), então marcamos Cancelado em vez de
      // deixar um convite "Criado" fantasma na lista.
      await supabase
        .from('convites')
        .update({ status: 'Cancelado', cancelado_em: new Date().toISOString() })
        .eq('id', conviteCriado.id);

      if (datasError.message.includes('data_ja_ofertada')) return { error: ERRO_DATA_OFERTADA, convite: null };
      return { error: ERRO_SALVAR, convite: null };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'convite_criado',
      descricao: 'Convite criado',
      dados: { convite_id: conviteCriado.id },
    });

    await carregar();

    const { data: completo } = await supabase
      .from('convites')
      .select(CONVITES_SELECT)
      .eq('id', conviteCriado.id)
      .single();

    return { error: null, convite: (completo ?? null) as unknown as Convite | null };
  }

  async function enviarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const { error } = await supabase
      .from('convites')
      .update({ status: 'Enviado', enviado_em: new Date().toISOString() })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_enviado',
      descricao: 'Convite enviado ao orador',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  async function reenviarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const novaExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('convites')
      .update({ status: 'Enviado', expira_em: novaExpiracao })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_reenviado',
      descricao: 'Convite reenviado ao orador',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  async function cancelarConvite(convite: Convite): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };
    if (['Recusado', 'Cancelado', 'Expirado'].includes(convite.status)) return { error: ERRO_JA_FINALIZADO };

    const { error } = await supabase
      .from('convites')
      .update({ status: 'Cancelado', cancelado_em: new Date().toISOString() })
      .eq('id', convite.id);

    if (error) return { error: ERRO_SALVAR };

    if (convite.programacao_id) {
      await supabase.from('programacoes').update({ status: 'Cancelada' }).eq('id', convite.programacao_id);
      await supabase.from('historicos').insert({
        programacao_id: convite.programacao_id,
        usuario_id: null,
        tipo: 'programacao_cancelada',
        descricao: 'Programação cancelada (convite cancelado)',
        dados: { convite_id: convite.id },
      });
    }

    await supabase.from('historicos').insert({
      programacao_id: convite.programacao_id,
      usuario_id: null,
      tipo: 'convite_cancelado',
      descricao: 'Convite cancelado',
      dados: { convite_id: convite.id },
    });

    await carregar();
    return { error: null };
  }

  return { status, convites, criarConvite, enviarConvite, reenviarConvite, cancelarConvite };
}
