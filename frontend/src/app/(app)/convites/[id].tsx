import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

export default function ConviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <View className="flex-1 items-center justify-center">
        <Text className="text-neutral-900 dark:text-white">Convite: {id}</Text>
      </View>
    </SafeAreaView>
  );
}
