import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useOradores } from '@/features/oradores/use-oradores';
import { normalizarTelefone } from '@/features/oradores/telefone';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';

type CongregacaoOpcao = { id: string; nome: string; numero: string };

const ERRO_CAMPOS = 'Preencha nome, sobrenome, telefone, cidade e congregação de origem.';
const ERRO_TELEFONE_INVALIDO = 'Informe um telefone válido, com DDD.';

export default function NovoOradorScreen() {
  const colors = useTheme();
  const { criarOrador } = useOradores();

  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [congregacaoOrigemId, setCongregacaoOrigemId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  useEffect(() => {
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
  }, []);

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !cidadeId || !congregacaoOrigemId) {
      setErro(ERRO_CAMPOS);
      return;
    }

    const telefoneNormalizado = normalizarTelefone(telefone);
    if (!telefoneNormalizado) {
      setErro(ERRO_TELEFONE_INVALIDO);
      return;
    }

    setSalvando(true);
    const { error, orador } = await criarOrador({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefoneNormalizado,
      email: email.trim(),
      cidadeId,
      congregacaoOrigemId,
    });
    setSalvando(false);

    if (error || !orador) {
      setErro(error ?? ERRO_CAMPOS);
      return;
    }

    router.replace(`/oradores/${orador.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Novo Orador</Text>

          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={sobrenome}
            onChangeText={setSobrenome}
            placeholder="Sobrenome"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={telefone}
            onChangeText={setTelefone}
            placeholder="Telefone, com DDD"
            keyboardType="phone-pad"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail (opcional)"
            keyboardType="email-address"
            autoCapitalize="none"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />

          <EstadoCidadePicker
            estadoId={estadoId}
            cidadeId={cidadeId}
            onEstadoChange={setEstadoId}
            onCidadeChange={setCidadeId}
            onErro={setErro}
          />

          <Dropdown
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }))}
            labelField="label"
            valueField="id"
            value={congregacaoOrigemId}
            placeholder="Congregação de origem"
            search
            searchPlaceholder="Buscar congregação..."
            onChange={(item) => setCongregacaoOrigemId(item.id)}
          />

          {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

          <Pressable
            onPress={handleSalvar}
            disabled={salvando}
            className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {salvando ? <ActivityIndicator /> : (
              <Text className="font-medium text-white dark:text-neutral-900">Salvar Orador</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
