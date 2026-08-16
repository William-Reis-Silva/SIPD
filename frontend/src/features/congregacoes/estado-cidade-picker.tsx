import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

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
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);
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
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={estados.map((e) => ({ id: e.id, label: `${e.nome} (${e.uf})` }))}
        labelField="label"
        valueField="id"
        value={estadoId}
        placeholder="Selecionar Estado"
        search
        searchPlaceholder="Buscar Estado..."
        onChange={(item) => {
          onEstadoChange(item.id);
          onCidadeChange('');
          setCidadeBusca('');
          setCidades([]);
        }}
      />

      <Dropdown
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        disable={!estadoId}
        data={cidades.map((c) => ({ id: c.id, label: c.nome }))}
        labelField="label"
        valueField="id"
        value={cidadeId}
        placeholder={estadoId ? 'Selecionar Cidade' : 'Selecione o Estado primeiro'}
        search
        searchPlaceholder="Buscar Cidade..."
        onChangeText={setCidadeBusca}
        onChange={(item) => {
          onCidadeChange(item.id);
          setCidadeBusca('');
        }}
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
