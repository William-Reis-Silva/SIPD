import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';

const ERRO_CAMPOS = 'Preencha o código, nome, sobrenome e telefone.';

export default function AceitarConviteScreen() {
  const { status, usuario, aceitarConvite } = useAuth();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const router = useRouter();

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (params.codigo) setCodigo(String(params.codigo).toUpperCase());
  }, [params.codigo]);

  useEffect(() => {
    if (status === 'authenticated' && usuario) {
      setNome(usuario.nome);
      setSobrenome(usuario.sobrenome);
      setTelefone(usuario.telefone ?? '');
    }
  }, [status, usuario]);

  async function handleSubmit() {
    setErro(null);
    if (!codigo.trim() || !nome.trim() || !sobrenome.trim() || !telefone.trim()) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setEnviando(true);
    const { error } = await aceitarConvite(codigo.trim().toUpperCase(), nome.trim(), sobrenome.trim(), telefone.trim());
    setEnviando(false);

    if (error) {
      setErro(error);
      return;
    }

    // Esta tela é "sempre alcançável" (fora dos Stack.Protected guards em
    // _layout.tsx), então o redirecionamento automático de guard não se
    // aplica aqui — precisa navegar explicitamente após o sucesso.
    router.replace('/');
  }

  if (status === 'unauthenticated') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <View className="w-full max-w-sm gap-3">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Você recebeu um convite</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Entre ou crie sua conta primeiro. Depois, abra este link de convite de novo para continuar.
          </Text>
          <Link
            href="/login"
            className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 text-center font-medium text-white dark:bg-white dark:text-neutral-900">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="items-center rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-medium text-neutral-900 dark:border-neutral-600 dark:text-white">
            Criar conta
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Aceitar Convite</Text>

        <TextInput
          value={codigo}
          onChangeText={(texto) => setCodigo(texto.toUpperCase())}
          placeholder="Código do convite"
          autoCapitalize="characters"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />
        <TextInput
          value={sobrenome}
          onChangeText={setSobrenome}
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

        <Pressable
          onPress={handleSubmit}
          disabled={enviando}
          className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {enviando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Aceitar convite</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
