import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';
import { useCongregacao } from '@/features/congregacoes/use-congregacao';

const PODE_EDITAR = ['Coordenador', 'Administrador Global'];

export default function CongregacaoScreen() {
  const { usuario } = useAuth();
  const { status, congregacao, atualizar } = useCongregacao();

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');

  const podeEditar = usuario ? PODE_EDITAR.includes(usuario.perfil.nome) : false;

  function iniciarEdicao() {
    if (!congregacao) return;
    setNome(congregacao.nome);
    setNumero(congregacao.numero);
    setEstadoId(congregacao.cidade.estado_id);
    setCidadeId(congregacao.cidade_id);
    setErro(null);
    setEditando(true);
  }

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !numero.trim()) {
      setErro('Informe o nome e o número da congregação.');
      return;
    }
    if (!cidadeId) {
      setErro('Selecione a cidade da congregação.');
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
            <EstadoCidadePicker
              estadoId={estadoId}
              cidadeId={cidadeId}
              onEstadoChange={setEstadoId}
              onCidadeChange={setCidadeId}
              onErro={setErro}
            />

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
    </SafeAreaView>
  );
}
