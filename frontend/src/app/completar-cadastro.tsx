import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Estado = { id: string; nome: string; uf: string };
type CidadeOpcao = { id: string; nome: string };

const ERRO_CRIAR_CIDADE = 'Não foi possível cadastrar a cidade. Tente novamente.';
const ERRO_CAMPOS_CONGREGACAO = 'Informe o nome e o número da congregação.';
const ERRO_CIDADE_OBRIGATORIA = 'Selecione a cidade da congregação.';
const ERRO_CAMPOS_USUARIO = 'Preencha todos os campos.';

function normalizar(texto: string) {
  return texto.trim().toLowerCase();
}

export default function CompletarCadastroScreen() {
  const { completarCadastro } = useAuth();
  const colors = useTheme();

  const [passo, setPasso] = useState<1 | 2>(1);
  const [enviando, setEnviando] = useState(false);
  const [criandoCidade, setCriandoCidade] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeCongregacao, setNomeCongregacao] = useState('');
  const [numero, setNumero] = useState('');
  const [estadoId, setEstadoId] = useState('');
  const [cidadeId, setCidadeId] = useState('');
  const [cidadeBusca, setCidadeBusca] = useState('');
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<CidadeOpcao[]>([]);

  const [nomeUsuario, setNomeUsuario] = useState('');
  const [sobrenomeUsuario, setSobrenomeUsuario] = useState('');
  const [telefone, setTelefone] = useState('');

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  useEffect(() => {
    supabase
      .from('estados')
      .select('id, nome, uf')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setEstados((data ?? []) as Estado[]));
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

  function handleContinuar() {
    setErro(null);
    if (!nomeCongregacao.trim() || !numero.trim()) {
      setErro(ERRO_CAMPOS_CONGREGACAO);
      return;
    }
    if (!cidadeId) {
      setErro(ERRO_CIDADE_OBRIGATORIA);
      return;
    }
    setPasso(2);
  }

  async function handleConcluir() {
    setErro(null);
    if (!nomeUsuario.trim() || !sobrenomeUsuario.trim() || !telefone.trim()) {
      setErro(ERRO_CAMPOS_USUARIO);
      return;
    }

    setEnviando(true);
    const { error } = await completarCadastro({
      nomeCongregacao: nomeCongregacao.trim(),
      numero: numero.trim(),
      cidadeId,
      nomeUsuario: nomeUsuario.trim(),
      sobrenomeUsuario: sobrenomeUsuario.trim(),
      telefone: telefone.trim(),
    });
    setEnviando(false);

    if (error) {
      setErro(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6 dark:bg-neutral-900">
      <View className="w-full max-w-sm gap-3 self-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Completar Cadastro</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {passo === 1 ? 'Passo 1 de 2 — Dados da congregação' : 'Passo 2 de 2 — Seus dados'}
        </Text>

        {passo === 1 ? (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeCongregacao}
              onChangeText={setNomeCongregacao}
              placeholder="Nome da congregação"
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

            <Pressable
              onPress={handleContinuar}
              className="mt-2 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
              <Text className="font-medium text-white dark:text-neutral-900">Continuar</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-4 gap-3">
            <TextInput
              value={nomeUsuario}
              onChangeText={setNomeUsuario}
              placeholder="Nome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={sobrenomeUsuario}
              onChangeText={setSobrenomeUsuario}
              placeholder="Sobrenome"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />
            <TextInput
              value={telefone}
              onChangeText={setTelefone}
              placeholder="Telefone"
              keyboardType="phone-pad"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />

            {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={() => {
                  setErro(null);
                  setPasso(1);
                }}
                className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Voltar</Text>
              </Pressable>
              <Pressable
                onPress={handleConcluir}
                disabled={enviando}
                className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {enviando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Concluir cadastro</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
