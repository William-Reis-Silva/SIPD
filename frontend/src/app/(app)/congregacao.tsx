import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCongregacao } from '@/features/congregacoes/use-congregacao';

export default function CongregacaoScreen() {
  const { status, congregacao } = useCongregacao();

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
      </View>
    </SafeAreaView>
  );
}
