import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes } from '@/features/programacoes/use-programacoes';
import { ProgramacaoForm, type CongregacaoOpcao } from '@/features/programacoes/programacao-form';

export default function NovaProgramacaoScreen() {
  const { usuario } = useAuth();
  const { data: dataPreenchida } = useLocalSearchParams<{ data?: string }>();
  const { criarProgramacao } = useProgramacoes();
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
    let ignorar = false;
    supabase
      .from('congregacoes')
      .select('id, nome, numero')
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCongregacoes((data ?? []) as CongregacaoOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, [ehAdministradorGlobal]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Nova Programação</Text>

          <ProgramacaoForm
            valoresIniciais={{
              data: dataPreenchida ?? '',
              congregacaoId: ehAdministradorGlobal ? '' : (usuario?.congregacao_id ?? ''),
              temaId: '',
              oradorId: '',
              observacoes: '',
            }}
            mostrarCongregacao={ehAdministradorGlobal}
            congregacoes={congregacoes}
            textoBotaoSalvar="Salvar Programação"
            onSalvar={async (valores) => {
              const { error, programacao } = await criarProgramacao(valores);
              if (!error && programacao) router.replace(`/programacoes/${programacao.id}`);
              return { error };
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
