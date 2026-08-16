import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { useCongregacao } from '@/features/congregacoes/use-congregacao';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };
type SeletorItem = { id: string; label: string };

const PODE_EDITAR = ['Coordenador', 'Administrador Global'];

function SeletorModal({
  visivel,
  titulo,
  itens,
  onSelecionar,
  onFechar,
}: {
  visivel: boolean;
  titulo: string;
  itens: SeletorItem[];
  onSelecionar: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
        <View className="flex-row items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">{titulo}</Text>
          <Pressable onPress={onFechar}>
            <Text className="text-base text-neutral-500 dark:text-neutral-400">Fechar</Text>
          </Pressable>
        </View>
        <FlatList
          data={itens}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelecionar(item.id)}
              className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <Text className="text-base text-neutral-900 dark:text-white">{item.label}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function CongregacaoScreen() {
  const { usuario } = useAuth();
  const { status, congregacao, atualizar } = useCongregacao();

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [estadoLabel, setEstadoLabel] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [cidadeLabel, setCidadeLabel] = useState('');

  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);
  const [seletorAberto, setSeletorAberto] = useState<'estado' | 'cidade' | null>(null);

  const podeEditar = usuario ? PODE_EDITAR.includes(usuario.perfil.nome) : false;

  function iniciarEdicao() {
    if (!congregacao) return;
    setNome(congregacao.nome);
    setNumero(congregacao.numero);
    setEstadoId(congregacao.cidade.estado_id);
    setCidadeId(congregacao.cidade_id);
    setCidadeLabel(congregacao.cidade.nome);
    setErro(null);
    setEditando(true);
  }

  useEffect(() => {
    if (!editando) return;
    supabase
      .from('estados')
      .select('id, nome, uf')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        const lista = (data ?? []) as Estado[];
        setEstados(lista);
        const atual = lista.find((e) => e.id === estadoId);
        if (atual) setEstadoLabel(`${atual.nome} (${atual.uf})`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  useEffect(() => {
    if (!editando || !estadoId) return;
    supabase
      .from('cidades')
      .select('id, nome')
      .eq('estado_id', estadoId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setCidades((data ?? []) as CidadeOpcao[]));
  }, [editando, estadoId]);

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !numero.trim()) {
      setErro('Informe o nome e o número da congregação.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizar({ nome: nome.trim(), numero: numero.trim(), cidade_id: cidadeId });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }

    setEditando(false);
  }

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !congregacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os dados da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Congregação</Text>

        {!editando ? (
          <>
            <View className="mt-4 gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Nome</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.nome}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Número</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.numero}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.cidade.nome}</Text>
              </View>
            </View>

            {podeEditar ? (
              <Pressable
                onPress={iniciarEdicao}
                className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={numero}
              onChangeText={setNumero}
              placeholder="Número"
              keyboardType="numeric"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <Pressable
              onPress={() => setSeletorAberto('estado')}
              className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-neutral-900 dark:text-white">{estadoLabel || 'Selecionar Estado'}</Text>
            </Pressable>
            <Pressable
              onPress={() => estadoId && setSeletorAberto('cidade')}
              className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-neutral-900 dark:text-white">{cidadeLabel || 'Selecionar Cidade'}</Text>
            </Pressable>

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => setEditando(false)}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSalvar}
                disabled={salvando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {salvando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <SeletorModal
        visivel={seletorAberto === 'estado'}
        titulo="Selecionar Estado"
        itens={estados.map((e) => ({ id: e.id, label: `${e.nome} (${e.uf})` }))}
        onSelecionar={(id) => {
          const escolhido = estados.find((e) => e.id === id);
          setEstadoId(id);
          setEstadoLabel(escolhido ? `${escolhido.nome} (${escolhido.uf})` : '');
          setCidadeId('');
          setCidadeLabel('');
          setCidades([]);
          setSeletorAberto(null);
        }}
        onFechar={() => setSeletorAberto(null)}
      />
      <SeletorModal
        visivel={seletorAberto === 'cidade'}
        titulo="Selecionar Cidade"
        itens={cidades.map((c) => ({ id: c.id, label: c.nome }))}
        onSelecionar={(id) => {
          const escolhida = cidades.find((c) => c.id === id);
          setCidadeId(id);
          setCidadeLabel(escolhida?.nome ?? '');
          setSeletorAberto(null);
        }}
        onFechar={() => setSeletorAberto(null)}
      />
    </SafeAreaView>
  );
}
