import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';

export default function HomeScreen() {
  const { usuario, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <View className="w-full max-w-sm items-center gap-3 px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">SIPD</Text>
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Sistema Inteligente de Programação de Discursos
        </Text>

        <View className="mt-6 w-full rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            {usuario?.nome} {usuario?.sobrenome}
          </Text>
          <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {usuario?.perfil.nome}
          </Text>
        </View>

        <Pressable
          onPress={() => signOut()}
          className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
