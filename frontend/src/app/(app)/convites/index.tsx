import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { useConvites, type Convite } from '@/features/convites/use-convites';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const STATUS_FILTROS: (Convite['status'] | 'Todos')[] = [
  'Todos',
  'Criado',
  'Enviado',
  'Aceito',
  'Recusado',
  'Cancelado',
  'Expirado',
];

export default function ConvitesScreen() {
  const { usuario } = useAuth();
  const { status, convites } = useConvites();
  const [filtro, setFiltro] = useState<(typeof STATUS_FILTROS)[number]>('Todos');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const convitesFiltrados = filtro === 'Todos' ? convites : convites.filter((c) => c.status === filtro);

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os convites.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Convites</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {STATUS_FILTROS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFiltro(s)}
                  className={`items-center rounded-lg border px-3 py-2 ${filtro === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">{s}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {convitesFiltrados.length === 0 ? (
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum convite encontrado.</Text>
          ) : null}
          {convitesFiltrados.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/convites/${c.id}`)}
              className="gap-2 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
              <Text className="text-base font-medium text-neutral-900 dark:text-white">
                {c.orador.nome} {c.orador.sobrenome}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">{c.status}</Text>
            </Pressable>
          ))}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/convites/novo')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Convite</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
