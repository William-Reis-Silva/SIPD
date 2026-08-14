import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

type ConnectionStatus = 'checking' | 'connected' | 'error';

export default function HomeScreen() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setDetail(error.message);
      } else {
        setStatus('connected');
        setDetail(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <View className="w-full max-w-sm items-center gap-3 px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">SIPD</Text>
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Sistema Inteligente de Programação de Discursos
        </Text>

        <View className="mt-6 w-full rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            Conexão com o Supabase
          </Text>
          <Text
            className={
              status === 'connected'
                ? 'mt-1 text-sm text-green-600 dark:text-green-400'
                : status === 'error'
                  ? 'mt-1 text-sm text-red-600 dark:text-red-400'
                  : 'mt-1 text-sm text-neutral-500 dark:text-neutral-400'
            }
          >
            {status === 'checking' && 'verificando…'}
            {status === 'connected' && 'conectado'}
            {status === 'error' && 'falhou'}
          </Text>
          {detail ? (
            <Text className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{detail}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
