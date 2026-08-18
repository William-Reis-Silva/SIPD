import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthProvider } from '@/features/administracao/auth-provider';
import { useAuth } from '@/features/administracao/use-auth';

import '@/global.css';

function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'onboarding'}>
        <Stack.Screen name="completar-cadastro" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
      {/* Sempre alcançável, independente do status — a própria tela decide
          o que renderizar por status (ver aceitar-convite.tsx). Precisa
          disso porque um convite de transferência é aceito por alguém já
          'authenticated', e um convite de conta nova por alguém em
          'onboarding' ou 'unauthenticated'. */}
      <Stack.Screen name="aceitar-convite" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
