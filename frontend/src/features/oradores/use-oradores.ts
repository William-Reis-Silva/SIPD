import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Orador = {
  id: string;
  nome: string;
  sobrenome: string;
  telefone_normalizado: string;
  email: string | null;
  cidade_id: string;
  cidade: { id: string; nome: string; estado_id: string };
  congregacao_origem_id: string;
  congregacao_origem: { id: string; nome: string; numero: string };
  usuario_id: string | null;
  ativo: boolean;
  temas_preparados: { tema_id: string }[];
};

export type OradoresStatus = 'loading' | 'ready' | 'error';

export type OradorInput = {
  nome: string;
  sobrenome: string;
  telefoneNormalizado: string;
  email: string;
  cidadeId: string;
  congregacaoOrigemId: string;
};

const ORADORES_SELECT =
  'id, nome, sobrenome, telefone_normalizado, email, cidade_id, cidade:cidades(id, nome, estado_id), ' +
  'congregacao_origem_id, congregacao_origem:congregacoes!congregacao_origem_id(id, nome, numero), ' +
  'usuario_id, ativo, temas_preparados(tema_id)';

const UNIQUE_VIOLATION = '23505';
const ERRO_TELEFONE_DUPLICADO = 'Já existe um orador com esse telefone.';
const ERRO_TRAVA_ORIGEM = 'Apenas o próprio orador vinculado pode alterar a congregação de origem.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';

function paraInsertUpdate(input: OradorInput) {
  return {
    nome: input.nome,
    sobrenome: input.sobrenome,
    telefone_normalizado: input.telefoneNormalizado,
    email: input.email || null,
    cidade_id: input.cidadeId,
    congregacao_origem_id: input.congregacaoOrigemId,
  };
}

export function useOradores() {
  const { usuario } = useAuth();
  const [oradores, setOradores] = useState<Orador[]>([]);
  const [status, setStatus] = useState<OradoresStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase.from('oradores').select(ORADORES_SELECT).order('nome');

    if (error) {
      setStatus('error');
      return;
    }

    setOradores((data ?? []) as unknown as Orador[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarOrador(input: OradorInput): Promise<{ error: string | null; orador: Orador | null }> {
    const { data, error } = await supabase
      .from('oradores')
      .insert(paraInsertUpdate(input))
      .select(ORADORES_SELECT)
      .single();

    if (error || !data) {
      if (error?.code === UNIQUE_VIOLATION) return { error: ERRO_TELEFONE_DUPLICADO, orador: null };
      return { error: ERRO_SALVAR, orador: null };
    }

    const orador = data as unknown as Orador;

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'orador_criado',
      descricao: 'Orador cadastrado',
      dados: { orador_id: orador.id, nome: orador.nome, sobrenome: orador.sobrenome },
    });

    await carregar();
    return { error: null, orador };
  }

  async function editarOrador(orador: Orador, input: OradorInput): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('oradores')
      .update(paraInsertUpdate(input))
      .eq('id', orador.id);

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_TELEFONE_DUPLICADO };
      if (error.message.includes('origem_travada_orador_vinculado')) return { error: ERRO_TRAVA_ORIGEM };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      usuario_id: null,
      tipo: 'orador_editado',
      descricao: 'Orador editado',
      dados: {
        orador_id: orador.id,
        nome_anterior: orador.nome,
        nome_novo: input.nome,
        telefone_anterior: orador.telefone_normalizado,
        telefone_novo: input.telefoneNormalizado,
        congregacao_origem_anterior_id: orador.congregacao_origem_id,
        congregacao_origem_nova_id: input.congregacaoOrigemId,
      },
    });

    await carregar();
    return { error: null };
  }

  return { status, oradores, criarOrador, editarOrador };
}
