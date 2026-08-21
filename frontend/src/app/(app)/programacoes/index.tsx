import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes } from '@/features/programacoes/use-programacoes';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { DropdownHoverItem } from '@/components/dropdown-hover-item';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const TODAS_CONGREGACOES = { id: '', label: 'Todas as congregações' };
const LIMIAR_CLIQUE_DUPLO_MS = 400;

type Aba = 'lista' | 'calendario';
type CongregacaoOpcao = { id: string; nome: string; numero: string };

export default function ProgramacoesScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, programacoes } = useProgramacoes();

  const congregacaoFiltroRef = useRef<IDropdownRef>(null);
  const [aba, setAba] = useState<Aba>('lista');
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [congregacaoFiltroId, setCongregacaoFiltroId] = useState('');
  const [congregacaoFiltroBusca, setCongregacaoFiltroBusca] = useState('');

  const hoje = new Date();
  const [anoCalendario, setAnoCalendario] = useState(hoje.getFullYear());
  const [mesCalendario, setMesCalendario] = useState(hoje.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const ultimoCliqueRef = useRef<{ dia: string; em: number } | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

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

  const programacoesFiltradas = congregacaoFiltroId
    ? programacoes.filter((p) => p.congregacao_id === congregacaoFiltroId)
    : programacoes;

  const diasComEvento = new Set(programacoesFiltradas.map((p) => p.data));
  const programacoesDoDia = diaSelecionado
    ? programacoesFiltradas.filter((p) => p.data === diaSelecionado)
    : [];

  const congregacaoOpcoes = [TODAS_CONGREGACOES, ...congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }))];

  function selecionarCongregacaoFiltro(item: { id: string; label: string }) {
    setCongregacaoFiltroId(item.id);
  }

  function handleClicarDia(dataIso: string) {
    const agora = Date.now();
    const ultimo = ultimoCliqueRef.current;
    const foiDuploClique = !!ultimo && ultimo.dia === dataIso && agora - ultimo.em < LIMIAR_CLIQUE_DUPLO_MS;
    ultimoCliqueRef.current = { dia: dataIso, em: agora };

    if (!foiDuploClique) {
      setDiaSelecionado(dataIso);
      return;
    }

    const programacaoDoDia = programacoesFiltradas.find((p) => p.data === dataIso);
    if (programacaoDoDia) {
      router.push(`/programacoes/${programacaoDoDia.id}`);
    } else {
      router.push({ pathname: '/programacoes/nova', params: { data: dataIso } });
    }
  }

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
          Não foi possível carregar as programações.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Programações</Text>

          {ehAdministradorGlobal ? (
            <Dropdown
              ref={congregacaoFiltroRef}
              style={dropdownStyle}
              containerStyle={{ backgroundColor: colors.background }}
              placeholderStyle={{ color: colors.textSecondary }}
              selectedTextStyle={{ color: colors.text }}
              itemTextStyle={{ color: colors.text }}
              inputSearchStyle={{ color: colors.text }}
              activeColor={colors.backgroundSelected}
              data={congregacaoOpcoes}
              labelField="label"
              valueField="id"
              value={congregacaoFiltroId}
              placeholder="Filtrar por congregação"
              search
              searchPlaceholder="Buscar congregação..."
              onChangeText={setCongregacaoFiltroBusca}
              onChange={selecionarCongregacaoFiltro}
              renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
              renderInputSearch={(onSearch) => (
                <DropdownSearchInput
                  value={congregacaoFiltroBusca}
                  onChangeText={onSearch}
                  onSubmitPrimeiraCorrespondencia={() => {
                    const primeiro = encontrarPrimeiraCorrespondencia(
                      congregacaoOpcoes,
                      'label',
                      congregacaoFiltroBusca
                    );
                    if (primeiro) selecionarCongregacaoFiltro(primeiro);
                    congregacaoFiltroRef.current?.close();
                  }}
                  placeholder="Buscar congregação..."
                  placeholderTextColor={colors.textSecondary}
                  color={colors.text}
                />
              )}
            />
          ) : null}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setAba('lista')}
              className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'lista' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Lista</Text>
            </Pressable>
            <Pressable
              onPress={() => setAba('calendario')}
              className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'calendario' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Calendário</Text>
            </Pressable>
          </View>

          {aba === 'lista' ? (
            <>
              {programacoesFiltradas.length === 0 ? (
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma programação encontrada.</Text>
              ) : null}
              {programacoesFiltradas.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/programacoes/${p.id}`)}
                  className="gap-2 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                  <Text className="text-base font-medium text-neutral-900 dark:text-white">
                    {formatarDataIso(p.data)} · {p.tema.numero}. {p.tema.titulo}
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                    {p.orador.nome} {p.orador.sobrenome} · {p.status}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <CalendarioMensal
                ano={anoCalendario}
                mes={mesCalendario}
                diasComEvento={diasComEvento}
                diaSelecionado={diaSelecionado}
                onSelecionarDia={handleClicarDia}
                onMudarMes={(ano, mes) => {
                  setAnoCalendario(ano);
                  setMesCalendario(mes);
                }}
              />
              {diaSelecionado ? (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                    {formatarDataIso(diaSelecionado)}
                  </Text>
                  {programacoesDoDia.length === 0 ? (
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma programação neste dia.</Text>
                  ) : (
                    programacoesDoDia.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => router.push(`/programacoes/${p.id}`)}
                        className="gap-1 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                        <Text className="text-base font-medium text-neutral-900 dark:text-white">
                          {p.tema.numero}. {p.tema.titulo}
                        </Text>
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                          {p.orador.nome} {p.orador.sobrenome} · {p.status}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/programacoes/nova')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Nova Programação</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
