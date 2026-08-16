import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';

import { useAuth } from '@/features/administracao/use-auth';
import { useCongregacao } from '@/features/congregacoes/use-congregacao';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };

const PODE_EDITAR = ['Coordenador', 'Administrador Global'];
const ERRO_CRIAR_CIDADE = 'Não foi possível cadastrar a cidade. Tente novamente.';

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

export default function CongregacaoScreen() {
  const { usuario } = useAuth();
  const { status, congregacao, atualizar } = useCongregacao();
  const colors = useTheme();

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [criandoCidade, setCriandoCidade] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [cidadeBusca, setCidadeBusca] = useState('');

  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);

  const podeEditar = usuario ? PODE_EDITAR.includes(usuario.perfil.nome) : false;

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  function iniciarEdicao() {
    if (!congregacao) return;
    setNome(congregacao.nome);
    setNumero(congregacao.numero);
    setEstadoId(congregacao.cidade.estado_id);
    setCidadeId(congregacao.cidade_id);
    setCidadeBusca('');
    setErro(null);
    setEditando(true);
  }

  useEffect(() => {
    if (!editando) return;
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
  }, [editando]);

  useEffect(() => {
    if (!editando || !estadoId) return;
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
  }, [editando, estadoId]);

  const cidadeEncontrada = cidades.some((c) => normalizar(c.nome) === normalizar(cidadeBusca));
  const mostrarCriarCidade = !!estadoId && cidadeBusca.trim().length > 0 && !cidadeEncontrada;

  async function handleCriarCidade() {
    if (!estadoId || !cidadeBusca.trim()) return;
    setErro(null);
    setCriandoCidade(true);
    const { data, error } = await supabase.rpc('encontrar_ou_criar_cidade', {
      p_estado_id: estadoId,
      p_nome: cidadeBusca.trim(),
    });
    setCriandoCidade(false);

    if (error || !data) {
      setErro(ERRO_CRIAR_CIDADE);
      return;
    }

    const novaCidade = { id: data as string, nome: cidadeBusca.trim() };
    setCidades((atual) => [...atual, novaCidade].sort((a, b) => a.nome.localeCompare(b.nome)));
    setCidadeId(novaCidade.id);
    setCidadeBusca('');
  }

  async function handleSalvar() {
    setErro(null);

    if (!nome.trim() || !numero.trim()) {
      setErro('Informe o nome e o número da congregação.');
      return;
    }
    if (!cidadeId) {
      setErro('Selecione a cidade da congregação.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizar({ nome: nome.trim(), numero: numero.trim(), cidade_id: cidadeId });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }

    setEditando(false);
  }

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !congregacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os dados da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Congregação</Text>

        {!editando ? (
          <>
            <View className="mt-4 gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Nome</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.nome}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Número</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.numero}</Text>
              </View>
              <View>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
                <Text className="text-base text-neutral-900 dark:text-white">{congregacao.cidade.nome}</Text>
              </View>
            </View>

            {podeEditar ? (
              <Pressable
                onPress={iniciarEdicao}
                className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={numero}
              onChangeText={setNumero}
              placeholder="Número"
              keyboardType="numeric"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
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
                setEstadoId(item.id);
                setCidadeId('');
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
                setCidadeId(item.id);
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

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => setEditando(false)}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSalvar}
                disabled={salvando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {salvando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
