import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';

function isEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit() {
    setErro(null);

    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    if (!isEmailValido(email.trim())) {
      setErro('Informe um e-mail válido.');
      return;
    }

    setEnviando(true);
    const { error } = await signIn(email.trim(), senha);
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <LinearGradient
      colors={['#3B2E86', '#1677D2', '#22D3C7']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm gap-3">
          <Image
            source={require('../../assets/images/logo-lockup.png')}
            style={{ width: 340, height: 179, alignSelf: 'center' }}
            resizeMode="contain"
            accessibilityLabel="SIPD — Sistema Inteligente de Programação de Discursos"
          />
          <Text className="mb-2 text-center text-white/70">Entre com sua conta para continuar.</Text>

          <View className="gap-3 rounded-2xl bg-white p-5 dark:bg-brand-light-dark">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-mail"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />

            <TextInput
              value={senha}
              onChangeText={setSenha}
              placeholder="Senha"
              secureTextEntry
              autoComplete="password"
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
                <Text className="font-medium text-white dark:text-neutral-900">Entrar</Text>
              )}
            </Pressable>

            <Link href="/signup" className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Não tem conta? Criar conta
            </Link>

            <Link
              href="/aceitar-convite"
              className="text-center text-sm text-neutral-500 underline dark:text-neutral-400">
              Tenho um código de convite
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
