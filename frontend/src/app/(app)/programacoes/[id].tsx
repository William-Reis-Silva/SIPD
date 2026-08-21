import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes, type Programacao } from '@/features/programacoes/use-programacoes';
import { useHistoricoProgramacao } from '@/features/programacoes/use-historico-programacao';
import { formatarDataIso } from '@/components/calendario-mensal';
import { ProgramacaoForm, type CongregacaoOpcao } from '@/features/programacoes/programacao-form';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

type Secao = 'dados' | 'historico';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function ProgramacaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const { status, programacoes, editarProgramacao, cancelarProgramacao, confirmarRealizacao } = useProgramacoes();
  const programacao = programacoes.find((p) => p.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !programacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar as programações.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {formatarDataIso(programacao.data)}
          </Text>

          <View className="flex-row gap-3">
            {(['dados', 'historico'] as Secao[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSecao(s)}
                className={`flex-1 items-center rounded-lg border px-3 py-2 ${secao === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s === 'dados' ? 'Dados' : 'Histórico'}
                </Text>
              </Pressable>
            ))}
          </View>

          {secao === 'dados' ? (
            <SecaoDados
              programacao={programacao}
              podeGerenciar={podeGerenciar}
              ehAdministradorGlobal={ehAdministradorGlobal}
              editarProgramacao={editarProgramacao}
              cancelarProgramacao={cancelarProgramacao}
              confirmarRealizacao={confirmarRealizacao}
            />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico programacaoId={programacao.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  programacao,
  podeGerenciar,
  ehAdministradorGlobal,
  editarProgramacao,
  cancelarProgramacao,
  confirmarRealizacao,
}: {
  programacao: Programacao;
  podeGerenciar: boolean;
  ehAdministradorGlobal: boolean;
  editarProgramacao: ReturnType<typeof useProgramacoes>['editarProgramacao'];
  cancelarProgramacao: ReturnType<typeof useProgramacoes>['cancelarProgramacao'];
  confirmarRealizacao: ReturnType<typeof useProgramacoes>['confirmarRealizacao'];
}) {
  const [editando, setEditando] = useState(false);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
    let ignorar = false;
    supabase
      .from('congregacoes')
      .select('id, nome, numero')
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCongregacoes((data ?? []) as CongregacaoOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, [ehAdministradorGlobal]);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const podeAlterar = podeGerenciar && programacao.status !== 'Realizada' && programacao.status !== 'Cancelada';
  const podeConfirmarRealizacao = podeAlterar && programacao.data <= hojeIso;

  async function handleCancelar() {
    setErro(null);
    setProcessando(true);
    const { error } = await cancelarProgramacao(programacao);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleConfirmarRealizacao() {
    setErro(null);
    setProcessando(true);
    const { error } = await confirmarRealizacao(programacao);
    setProcessando(false);
    if (error) setErro(error);
  }

  if (editando) {
    return (
      <ProgramacaoForm
        valoresIniciais={{
          data: programacao.data,
          congregacaoId: programacao.congregacao_id,
          temaId: programacao.tema_id,
          oradorId: programacao.orador_id,
          observacoes: programacao.observacoes ?? '',
        }}
        mostrarCongregacao={ehAdministradorGlobal}
        congregacoes={congregacoes}
        textoBotaoSalvar="Salvar"
        onCancelar={() => setEditando(false)}
        onSalvar={async (valores) => {
          const { error } = await editarProgramacao(programacao, valores);
          if (!error) setEditando(false);
          return { error };
        }}
      />
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Congregação</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.congregacao.nome} ({programacao.congregacao.numero})
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Tema</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.tema.numero}. {programacao.tema.titulo}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Orador</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.orador.nome} {programacao.orador.sobrenome}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Status</Text>
          <Text className="text-base text-neutral-900 dark:text-white">{programacao.status}</Text>
        </View>
        {programacao.observacoes ? (
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Observações</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{programacao.observacoes}</Text>
          </View>
        ) : null}
      </View>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {podeAlterar ? (
        <Pressable
          onPress={() => setEditando(true)}
          className="items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
        </Pressable>
      ) : null}

      {podeConfirmarRealizacao ? (
        <Pressable
          onPress={handleConfirmarRealizacao}
          disabled={processando}
          className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Confirmar Realização</Text>
          )}
        </Pressable>
      ) : null}

      {podeAlterar ? (
        <Pressable
          onPress={handleCancelar}
          disabled={processando}
          className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Cancelar Programação</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ programacaoId }: { programacaoId: string }) {
  const { status, eventos } = useHistoricoProgramacao(programacaoId);

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  if (eventos.length === 0) {
    return (
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum evento registrado ainda.</Text>
    );
  }

  return (
    <View className="gap-3">
      {eventos.map((e) => (
        <View key={e.id} className="gap-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">{e.descricao}</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{formatarDataHora(e.criado_em)}</Text>
        </View>
      ))}
    </View>
  );
}
