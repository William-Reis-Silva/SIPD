import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';

function isEmailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupScreen() {
  const { signUp } = useAuth();
  const senhaRef = useRef<TextInput>(null);
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
    const { error } = await signUp(email.trim(), senha);
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-brand-light-dark">
      <View className="w-full max-w-sm gap-3">
        <Image
          source={require('../../assets/images/icon-mark.png')}
          style={{ width: 120, height: 120, alignSelf: 'center' }}
          resizeMode="contain"
          accessibilityLabel="SIPD"
        />
        <Text className="text-center text-3xl font-bold text-neutral-900 dark:text-white">SIPD</Text>
        <Text className="mb-4 text-base text-neutral-500 dark:text-neutral-400">
          Crie sua conta para continuar.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => senhaRef.current?.focus()}
          blurOnSubmit={false}
          className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
        />

        <TextInput
          ref={senhaRef}
          value={senha}
          onChangeText={setSenha}
          placeholder="Senha"
          secureTextEntry
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
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
            <Text className="font-medium text-white dark:text-neutral-900">Criar conta</Text>
          )}
        </Pressable>

        <Link href="/login" className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Já tem conta? Entrar
        </Link>

        <Link
          href="/aceitar-convite"
          className="text-center text-sm text-neutral-500 underline dark:text-neutral-400">
          Tenho um código de convite
        </Link>
      </View>
    </SafeAreaView>
  );
}
