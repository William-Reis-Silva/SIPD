import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';

const ERRO_CAMPOS_CONGREGACAO = 'Informe o nome e o número da congregação.';
const ERRO_CIDADE_OBRIGATORIA = 'Selecione a cidade da congregação.';
const ERRO_CAMPOS_USUARIO = 'Preencha todos os campos.';

export default function CompletarCadastroScreen() {
  const { completarCadastro, signOut } = useAuth();

  const [passo, setPasso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeCongregacao, setNomeCongregacao] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');

  const [nomeUsuario, setNomeUsuario] = useState('');
  const [sobrenomeUsuario, setSobrenomeUsuario] = useState('');
  const [telefone, setTelefone] = useState('');

  function handleContinuar() {
    setErro(null);
    if (!nomeCongregacao.trim() || !numero.trim()) {
      setErro(ERRO_CAMPOS_CONGREGACAO);
      return;
    }
    if (!cidadeId) {
      setErro(ERRO_CIDADE_OBRIGATORIA);
      return;
    }
    setPasso(2);
  }

  async function handleConcluir() {
    setErro(null);
    if (!nomeUsuario.trim() || !sobrenomeUsuario.trim() || !telefone.trim()) {
      setErro(ERRO_CAMPOS_USUARIO);
      return;
    }

    setEnviando(true);
    const { error } = await completarCadastro({
      nomeCongregacao: nomeCongregacao.trim(),
      numero: numero.trim(),
      cidadeId,
      nomeUsuario: nomeUsuario.trim(),
      sobrenomeUsuario: sobrenomeUsuario.trim(),
      telefone: telefone.trim(),
    });
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Completar Cadastro</Text>
          <Pressable onPress={() => signOut()}>
            <Text className="text-sm text-neutral-500 underline dark:text-neutral-400">Sair</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {passo === 1 ? 'Passo 1 de 2 — Dados da congregação' : 'Passo 2 de 2 — Seus dados'}
        </Text>

        {passo === 1 ? (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeCongregacao}
              onChangeText={setNomeCongregacao}
              placeholder="Nome da congregação"
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

            <Pressable
              onPress={handleContinuar}
              className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
              <Text className="font-medium text-white dark:text-neutral-900">Continuar</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeUsuario}
              onChangeText={setNomeUsuario}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={sobrenomeUsuario}
              onChangeText={setSobrenomeUsuario}
              placeholder="Sobrenome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={telefone}
              onChangeText={setTelefone}
              placeholder="Telefone"
              keyboardType="phone-pad"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => {
                  setErro(null);
                  setPasso(1);
                }}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConcluir}
                disabled={enviando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {enviando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Concluir cadastro</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
