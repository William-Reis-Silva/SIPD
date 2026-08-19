import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useOradores } from '@/features/oradores/use-oradores';
import { useTemas } from '@/features/catalogo/use-temas';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

function buscarTemaPorNumeroExato(keyword: string, labelValue: string): boolean {
  const numero = labelValue.split('.')[0];
  if (/^\d+$/.test(keyword)) {
    return numero === keyword;
  }
  return labelValue.toLowerCase().includes(keyword.toLowerCase());
}

export default function OradoresListaScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, oradores } = useOradores();
  const { temas } = useTemas();

  const [busca, setBusca] = useState('');
  const [temaFiltroId, setTemaFiltroId] = useState<string | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const oradoresFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return oradores.filter((o) => {
      if (temaFiltroId && !o.temas_preparados.some((tp) => tp.tema_id === temaFiltroId)) return false;
      if (!buscaNormalizada) return true;
      const nomeCompleto = `${o.nome} ${o.sobrenome}`.toLowerCase();
      return nomeCompleto.includes(buscaNormalizada) || o.telefone_normalizado.includes(buscaNormalizada);
    });
  }, [oradores, busca, temaFiltroId]);

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
          Não foi possível carregar os oradores.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Oradores</Text>

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome ou telefone"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />

          <Dropdown
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={[{ id: '', label: 'Todos os temas' }, ...temas.map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }))]}
            labelField="label"
            valueField="id"
            value={temaFiltroId ?? ''}
            placeholder="Filtrar por tema"
            search
            searchQuery={buscarTemaPorNumeroExato}
            searchPlaceholder="Buscar tema..."
            onChange={(item) => setTemaFiltroId(item.id || null)}
          />

          {oradoresFiltrados.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => router.push(`/oradores/${o.id}`)}
              className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <Text className="text-base font-medium text-neutral-900 dark:text-white">
                {o.nome} {o.sobrenome}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {o.congregacao_origem.nome} · {o.cidade.nome}
              </Text>
            </Pressable>
          ))}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/oradores/novo')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Orador</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
