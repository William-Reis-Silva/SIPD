import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useOradores } from '@/features/oradores/use-oradores';
import { useConvites } from '@/features/convites/use-convites';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { DropdownHoverItem } from '@/components/dropdown-hover-item';

const ERRO_CAMPOS = 'Selecione um orador e ao menos uma data candidata.';

export default function NovoConviteScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { oradores } = useOradores();
  const { criarConvite } = useConvites();

  const oradorRef = useRef<IDropdownRef>(null);
  const [oradorId, setOradorId] = useState('');
  const [oradorBusca, setOradorBusca] = useState('');
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const hoje = new Date();
  const [anoCalendario, setAnoCalendario] = useState(hoje.getFullYear());
  const [mesCalendario, setMesCalendario] = useState(hoje.getMonth());

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const oradorOpcoes = oradores.filter((o) => o.ativo).map((o) => ({ id: o.id, label: `${o.nome} ${o.sobrenome}` }));

  function alternarData(dataIso: string) {
    setDiasSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(dataIso)) proximo.delete(dataIso);
      else proximo.add(dataIso);
      return proximo;
    });
  }

  async function handleSalvar() {
    setErro(null);
    if (!oradorId || diasSelecionados.size === 0) {
      setErro(ERRO_CAMPOS);
      return;
    }
    if (!usuario) return;

    setSalvando(true);
    const { error, convite } = await criarConvite({
      oradorId,
      congregacaoId: usuario.congregacao_id,
      datas: Array.from(diasSelecionados),
    });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }
    if (convite) router.replace(`/convites/${convite.id}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Novo Convite</Text>

          <Dropdown
            ref={oradorRef}
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            inputSearchStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={oradorOpcoes}
            labelField="label"
            valueField="id"
            value={oradorId}
            placeholder="Selecionar orador"
            search
            searchPlaceholder="Buscar orador..."
            onChangeText={setOradorBusca}
            onChange={(item) => setOradorId(item.id)}
            renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
            renderInputSearch={(onSearch) => (
              <DropdownSearchInput
                value={oradorBusca}
                onChangeText={onSearch}
                onSubmitPrimeiraCorrespondencia={() => {
                  const primeiro = encontrarPrimeiraCorrespondencia(oradorOpcoes, 'label', oradorBusca);
                  if (primeiro) setOradorId(primeiro.id);
                  oradorRef.current?.close();
                }}
                placeholder="Buscar orador..."
                placeholderTextColor={colors.textSecondary}
                color={colors.text}
              />
            )}
          />

          <Text className="text-sm font-medium text-neutral-900 dark:text-white">
            Datas candidatas (toque para selecionar mais de uma)
          </Text>
          <CalendarioMensal
            ano={anoCalendario}
            mes={mesCalendario}
            diasSelecionados={diasSelecionados}
            onSelecionarDia={alternarData}
            onMudarMes={(ano, mes) => {
              setAnoCalendario(ano);
              setMesCalendario(mes);
            }}
          />

          {diasSelecionados.size > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {Array.from(diasSelecionados)
                .sort()
                .map((data) => (
                  <Pressable
                    key={data}
                    onPress={() => alternarData(data)}
                    className="flex-row items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-600">
                    <Text className="text-xs text-neutral-900 dark:text-white">{formatarDataIso(data)}</Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">×</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}

          {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

          <Pressable
            onPress={handleSalvar}
            disabled={salvando}
            className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {salvando ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-medium text-white dark:text-neutral-900">Criar Convite</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
