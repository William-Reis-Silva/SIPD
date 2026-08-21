import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';

import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { DropdownHoverItem } from '@/components/dropdown-hover-item';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { useTheme } from '@/hooks/use-theme';
import { useTemas } from '@/features/catalogo/use-temas';
import { useOradores } from '@/features/oradores/use-oradores';
import type { ProgramacaoInput } from '@/features/programacoes/use-programacoes';

export type CongregacaoOpcao = { id: string; nome: string; numero: string };

const ERRO_CAMPOS = 'Preencha data, tema e orador.';

export function ProgramacaoForm({
  valoresIniciais,
  mostrarCongregacao,
  congregacoes,
  onSalvar,
  onCancelar,
  textoBotaoSalvar,
}: {
  valoresIniciais: ProgramacaoInput;
  mostrarCongregacao: boolean;
  congregacoes: CongregacaoOpcao[];
  onSalvar: (valores: ProgramacaoInput) => Promise<{ error: string | null }>;
  onCancelar?: () => void;
  textoBotaoSalvar: string;
}) {
  const colors = useTheme();
  const { temas } = useTemas();
  const { oradores } = useOradores();

  const congregacaoRef = useRef<IDropdownRef>(null);
  const temaRef = useRef<IDropdownRef>(null);
  const oradorRef = useRef<IDropdownRef>(null);

  const [data, setData] = useState(valoresIniciais.data);
  const [congregacaoId, setCongregacaoId] = useState(valoresIniciais.congregacaoId);
  const [congregacaoBusca, setCongregacaoBusca] = useState('');
  const [temaId, setTemaId] = useState(valoresIniciais.temaId);
  const [temaBusca, setTemaBusca] = useState('');
  const [oradorId, setOradorId] = useState(valoresIniciais.oradorId);
  const [oradorBusca, setOradorBusca] = useState('');
  const [observacoes, setObservacoes] = useState(valoresIniciais.observacoes);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const hoje = new Date();
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [anoCalendario, setAnoCalendario] = useState(
    data ? Number(data.slice(0, 4)) : hoje.getFullYear()
  );
  const [mesCalendario, setMesCalendario] = useState(
    data ? Number(data.slice(5, 7)) - 1 : hoje.getMonth()
  );

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temaOpcoes = temas.filter((t) => t.ativo).map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }));
  const temaSelecionado = temas.find((t) => t.id === temaId) ?? null;

  const oradorOpcoes = [...oradores.filter((o) => o.ativo)]
    .sort((a, b) => {
      const aPreparado = temaId ? a.temas_preparados.some((tp) => tp.tema_id === temaId) : false;
      const bPreparado = temaId ? b.temas_preparados.some((tp) => tp.tema_id === temaId) : false;
      if (aPreparado === bPreparado) return 0;
      return aPreparado ? -1 : 1;
    })
    .map((o) => ({ id: o.id, label: `${o.nome} ${o.sobrenome}` }));

  const congregacaoOpcoes = congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }));

  async function handleSalvar() {
    setErro(null);
    if (!data || !temaId || !oradorId || (mostrarCongregacao && !congregacaoId)) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setSalvando(true);
    const { error } = await onSalvar({ data, congregacaoId, temaId, oradorId, observacoes });
    setSalvando(false);

    if (error) setErro(error);
  }

  return (
    <View style={{ gap: 12 }}>
      {mostrarCongregacao ? (
        <Dropdown
          ref={congregacaoRef}
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
          value={congregacaoId}
          placeholder="Selecionar congregação"
          search
          searchPlaceholder="Buscar congregação..."
          onChangeText={setCongregacaoBusca}
          onChange={(item) => setCongregacaoId(item.id)}
          renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
          renderInputSearch={(onSearch) => (
            <DropdownSearchInput
              value={congregacaoBusca}
              onChangeText={onSearch}
              onSubmitPrimeiraCorrespondencia={() => {
                const primeiro = encontrarPrimeiraCorrespondencia(congregacaoOpcoes, 'label', congregacaoBusca);
                if (primeiro) setCongregacaoId(primeiro.id);
                congregacaoRef.current?.close();
              }}
              placeholder="Buscar congregação..."
              placeholderTextColor={colors.textSecondary}
              color={colors.text}
            />
          )}
        />
      ) : null}

      <View>
        <Pressable
          onPress={() => setCalendarioAberto(!calendarioAberto)}
          className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-neutral-900 dark:text-white">
            {data ? formatarDataIso(data) : 'Selecionar data'}
          </Text>
        </Pressable>
        {calendarioAberto ? (
          <View className="mt-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <CalendarioMensal
              ano={anoCalendario}
              mes={mesCalendario}
              diaSelecionado={data}
              onSelecionarDia={(dataIso) => {
                setData(dataIso);
                setCalendarioAberto(false);
              }}
              onMudarMes={(ano, mes) => {
                setAnoCalendario(ano);
                setMesCalendario(mes);
              }}
            />
          </View>
        ) : null}
      </View>

      <Dropdown
        ref={temaRef}
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        inputSearchStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={temaOpcoes}
        labelField="label"
        valueField="id"
        value={temaId}
        placeholder="Selecionar tema"
        search
        searchPlaceholder="Buscar tema..."
        onChangeText={setTemaBusca}
        onChange={(item) => setTemaId(item.id)}
        renderItem={(item) => <DropdownHoverItem label={item.label} textColor={colors.text} />}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={temaBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(temaOpcoes, 'label', temaBusca);
              if (primeiro) setTemaId(primeiro.id);
              temaRef.current?.close();
            }}
            placeholder="Buscar tema..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />
      {temaSelecionado ? (
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {temaSelecionado.numero}. {temaSelecionado.titulo} · {temaSelecionado.categoria?.nome ?? 'Categoria indisponível'}
        </Text>
      ) : null}

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

      <TextInput
        value={observacoes}
        onChangeText={setObservacoes}
        placeholder="Observações (opcional)"
        multiline
        numberOfLines={3}
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <View className="flex-row gap-3">
        <Pressable
          onPress={handleSalvar}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">{textoBotaoSalvar}</Text>
          )}
        </Pressable>
        {onCancelar ? (
          <Pressable
            onPress={onCancelar}
            className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
