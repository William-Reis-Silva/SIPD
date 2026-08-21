import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Programacao = {
  id: string;
  congregacao_id: string;
  congregacao: { id: string; nome: string; numero: string };
  tema_id: string;
  tema: { id: string; numero: string; titulo: string; categoria: { id: string; nome: string } | null };
  orador_id: string;
  orador: { id: string; nome: string; sobrenome: string };
  data: string;
  status: 'Planejada' | 'Convite Enviado' | 'Confirmada' | 'Realizada' | 'Cancelada' | 'Arquivada';
  observacoes: string | null;
  criado_por: string;
};

export type ProgramacoesStatus = 'loading' | 'ready' | 'error';

export type ProgramacaoInput = {
  data: string;
  congregacaoId: string;
  temaId: string;
  oradorId: string;
  observacoes: string;
};

const PROGRAMACOES_SELECT =
  'id, congregacao_id, congregacao:congregacoes(id, nome, numero), ' +
  'tema_id, tema:temas(id, numero, titulo, categoria:categorias(id, nome)), ' +
  'orador_id, orador:oradores(id, nome, sobrenome), ' +
  'data, status, observacoes, criado_por';

const UNIQUE_VIOLATION = '23505';
const ERRO_DATA_DUPLICADA = 'Já existe uma programação para esta congregação nesta data.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';
const ERRO_JA_CONCLUIDA = 'Esta programação já foi realizada ou cancelada e não pode ser alterada.';
const ERRO_NAO_PODE_CONFIRMAR = 'Não é possível confirmar a realização ainda.';

function paraInsertUpdate(input: ProgramacaoInput) {
  return {
    congregacao_id: input.congregacaoId,
    tema_id: input.temaId,
    orador_id: input.oradorId,
    data: input.data,
    observacoes: input.observacoes || null,
  };
}

export function useProgramacoes() {
  const { usuario } = useAuth();
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [status, setStatus] = useState<ProgramacoesStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('programacoes')
      .select(PROGRAMACOES_SELECT)
      .order('data');

    if (error) {
      setStatus('error');
      return;
    }

    setProgramacoes((data ?? []) as unknown as Programacao[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarProgramacao(
    input: ProgramacaoInput
  ): Promise<{ error: string | null; programacao: Programacao | null }> {
    if (!usuario) return { error: ERRO_SALVAR, programacao: null };

    const { data, error } = await supabase
      .from('programacoes')
      .insert({ ...paraInsertUpdate(input), status: 'Planejada', criado_por: usuario.id })
      .select(PROGRAMACOES_SELECT)
      .single();

    if (error || !data) {
      if (error?.code === UNIQUE_VIOLATION) return { error: ERRO_DATA_DUPLICADA, programacao: null };
      return { error: ERRO_SALVAR, programacao: null };
    }

    const programacao = data as unknown as Programacao;

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_criada',
      descricao: 'Programação criada',
    });

    await carregar();
    return { error: null, programacao };
  }

  async function editarProgramacao(
    programacao: Programacao,
    input: ProgramacaoInput
  ): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const { error } = await supabase
      .from('programacoes')
      .update(paraInsertUpdate(input))
      .eq('id', programacao.id);

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_DATA_DUPLICADA };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_editada',
      descricao: 'Programação editada',
    });

    await carregar();
    return { error: null };
  }

  async function cancelarProgramacao(programacao: Programacao): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };
    if (programacao.status === 'Realizada' || programacao.status === 'Cancelada') {
      return { error: ERRO_JA_CONCLUIDA };
    }

    const { error } = await supabase
      .from('programacoes')
      .update({ status: 'Cancelada' })
      .eq('id', programacao.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_cancelada',
      descricao: 'Programação cancelada',
    });

    await carregar();
    return { error: null };
  }

  async function confirmarRealizacao(programacao: Programacao): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const hojeIso = new Date().toISOString().slice(0, 10);
    if (
      programacao.status === 'Realizada' ||
      programacao.status === 'Cancelada' ||
      programacao.data > hojeIso
    ) {
      return { error: ERRO_NAO_PODE_CONFIRMAR };
    }

    const { error } = await supabase
      .from('programacoes')
      .update({ status: 'Realizada' })
      .eq('id', programacao.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_realizada',
      descricao: 'Realização da programação confirmada',
    });

    await carregar();
    return { error: null };
  }

  return { status, programacoes, criarProgramacao, editarProgramacao, cancelarProgramacao, confirmarRealizacao };
}
