import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NovoOradorScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <View>
        <Text className="text-neutral-500 dark:text-neutral-400">Em construção.</Text>
      </View>
    </SafeAreaView>
  );
}
