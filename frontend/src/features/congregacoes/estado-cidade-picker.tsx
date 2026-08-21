import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';

import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };

const ERRO_CRIAR_CIDADE = 'Não foi possível cadastrar a cidade. Tente novamente.';

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

export type EstadoCidadePickerProps = {
  estadoId: string;
  cidadeId: string;
  onEstadoChange: (estadoId: string) => void;
  onCidadeChange: (cidadeId: string) => void;
  onErro: (mensagem: string) => void;
};

export function EstadoCidadePicker({
  estadoId,
  cidadeId,
  onEstadoChange,
  onCidadeChange,
  onErro,
}: EstadoCidadePickerProps) {
  const colors = useTheme();
  const estadoRef = useRef<IDropdownRef>(null);
  const cidadeRef = useRef<IDropdownRef>(null);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);
  const [estadoBusca, setEstadoBusca] = useState('');
  const [cidadeBusca, setCidadeBusca] = useState('');
  const [criandoCidade, setCriandoCidade] = useState(false);

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
      .from('estados')
      .select('id, nome, uf')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setEstados((data ?? []) as Estado[]);
      });
    return () => {
      ignorar = true;
    };
  }, []);

  useEffect(() => {
    if (!estadoId) return;
    let ignorar = false;
    supabase
      .from('cidades')
      .select('id, nome')
      .eq('estado_id', estadoId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        if (!ignorar) setCidades((data ?? []) as CidadeOpcao[]);
      });
    return () => {
      ignorar = true;
    };
  }, [estadoId]);

  const estadoOpcoes = estados.map((e) => ({ id: e.id, label: `${e.nome} (${e.uf})` }));
  const cidadeOpcoes = cidades.map((c) => ({ id: c.id, label: c.nome }));

  function selecionarEstado(item: { id: string; label: string }) {
    onEstadoChange(item.id);
    onCidadeChange('');
    setCidadeBusca('');
    setCidades([]);
  }

  function selecionarCidade(item: { id: string; label: string }) {
    onCidadeChange(item.id);
    setCidadeBusca('');
  }

  const cidadeEncontrada = cidades.some((c) => normalizar(c.nome) === normalizar(cidadeBusca));
  const mostrarCriarCidade = !!estadoId && cidadeBusca.trim().length > 0 && !cidadeEncontrada;

  async function handleCriarCidade() {
    if (!estadoId || !cidadeBusca.trim()) return;
    setCriandoCidade(true);
    const { data, error } = await supabase.rpc('encontrar_ou_criar_cidade', {
      p_estado_id: estadoId,
      p_nome: cidadeBusca.trim(),
    });
    setCriandoCidade(false);

    if (error || !data) {
      onErro(ERRO_CRIAR_CIDADE);
      return;
    }

    const novaCidade = { id: data as string, nome: cidadeBusca.trim() };
    setCidades((atual) => [...atual, novaCidade].sort((a, b) => a.nome.localeCompare(b.nome)));
    onCidadeChange(novaCidade.id);
    setCidadeBusca('');
  }

  return (
    <>
      <Dropdown
        ref={estadoRef}
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        inputSearchStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={estadoOpcoes}
        labelField="label"
        valueField="id"
        value={estadoId}
        placeholder="Selecionar Estado"
        search
        searchPlaceholder="Buscar Estado..."
        onChangeText={setEstadoBusca}
        onChange={selecionarEstado}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={estadoBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(estadoOpcoes, 'label', estadoBusca);
              if (primeiro) selecionarEstado(primeiro);
              estadoRef.current?.close();
            }}
            placeholder="Buscar Estado..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />

      <Dropdown
        ref={cidadeRef}
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        inputSearchStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        disable={!estadoId}
        data={cidadeOpcoes}
        labelField="label"
        valueField="id"
        value={cidadeId}
        placeholder={estadoId ? 'Selecionar Cidade' : 'Selecione o Estado primeiro'}
        search
        searchPlaceholder="Buscar Cidade..."
        onChangeText={setCidadeBusca}
        onChange={selecionarCidade}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={cidadeBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(cidadeOpcoes, 'label', cidadeBusca);
              if (primeiro) selecionarCidade(primeiro);
              cidadeRef.current?.close();
            }}
            placeholder="Buscar Cidade..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />

      {mostrarCriarCidade ? (
        <Pressable
          onPress={handleCriarCidade}
          disabled={criandoCidade}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-400 px-4 py-3 dark:border-neutral-500">
          {criandoCidade ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">
              Cadastrar cidade &quot;{cidadeBusca.trim()}&quot;
            </Text>
          )}
        </Pressable>
      ) : null}
    </>
  );
}
