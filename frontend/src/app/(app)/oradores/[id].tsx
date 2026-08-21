import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown, type IDropdownRef } from 'react-native-element-dropdown';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useOradores, type Orador } from '@/features/oradores/use-oradores';
import { useTemasPreparados, type TemaPreparado } from '@/features/oradores/use-temas-preparados';
import { useHistoricoOrador } from '@/features/oradores/use-historico-orador';
import { useTemas } from '@/features/catalogo/use-temas';
import { normalizarTelefone, formatarTelefone } from '@/features/oradores/telefone';
import { EstadoCidadePicker } from '@/features/congregacoes/estado-cidade-picker';
import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';

type CongregacaoOpcao = { id: string; nome: string; numero: string };

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const ERRO_CAMPOS = 'Preencha nome, sobrenome, telefone, cidade e congregação de origem.';
const ERRO_TELEFONE_INVALIDO = 'Informe um telefone válido, com DDD.';

type Secao = 'dados' | 'temas' | 'historico';

function buscarTemaPorNumeroExato(keyword: string, labelValue: string): boolean {
  const numero = labelValue.split('.')[0];
  if (/^\d+$/.test(keyword)) {
    return numero === keyword;
  }
  return labelValue.toLowerCase().includes(keyword.toLowerCase());
}

function ordenarTemasPorRelevancia<T extends { titulo: string }>(temas: T[], busca: string): T[] {
  const buscaNormalizada = busca.trim().toLowerCase();
  if (!buscaNormalizada || /^\d+$/.test(buscaNormalizada)) return temas;

  return [...temas].sort((a, b) => {
    const aComeca = a.titulo.toLowerCase().startsWith(buscaNormalizada);
    const bComeca = b.titulo.toLowerCase().startsWith(buscaNormalizada);
    if (aComeca === bComeca) return 0;
    return aComeca ? -1 : 1;
  });
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function OradorDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, oradores, editarOrador } = useOradores();
  const orador = oradores.find((o) => o.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !orador) {
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
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
            {orador.nome} {orador.sobrenome}
          </Text>

          <View className="flex-row gap-3">
            {(['dados', 'temas', 'historico'] as Secao[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSecao(s)}
                className={`flex-1 items-center rounded-lg border px-3 py-2 ${secao === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s === 'dados' ? 'Dados' : s === 'temas' ? 'Temas Preparados' : 'Histórico'}
                </Text>
              </Pressable>
            ))}
          </View>

          {secao === 'dados' ? (
            <SecaoDados orador={orador} podeGerenciar={podeGerenciar} colors={colors} editarOrador={editarOrador} />
          ) : null}
          {secao === 'temas' ? (
            <SecaoTemasPreparados oradorId={orador.id} podeGerenciar={podeGerenciar} colors={colors} />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico oradorId={orador.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  orador,
  podeGerenciar,
  colors,
  editarOrador,
}: {
  orador: Orador;
  podeGerenciar: boolean;
  colors: ReturnType<typeof useTheme>;
  editarOrador: (orador: Orador, input: Parameters<ReturnType<typeof useOradores>['editarOrador']>[1]) => ReturnType<ReturnType<typeof useOradores>['editarOrador']>;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(orador.nome);
  const [sobrenome, setSobrenome] = useState(orador.sobrenome);
  const [telefone, setTelefone] = useState(formatarTelefone(orador.telefone_normalizado));
  const [email, setEmail] = useState(orador.email ?? '');
  const [estadoId, setEstadoId] = useState(orador.cidade.estado_id);
  const [cidadeId, setCidadeId] = useState(orador.cidade_id);
  const [congregacaoOrigemId, setCongregacaoOrigemId] = useState(orador.congregacao_origem_id);
  const congregacaoRef = useRef<IDropdownRef>(null);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [congregacaoBusca, setCongregacaoBusca] = useState('');
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

  function iniciarEdicao() {
    setNome(orador.nome);
    setSobrenome(orador.sobrenome);
    setTelefone(formatarTelefone(orador.telefone_normalizado));
    setEmail(orador.email ?? '');
    setEstadoId(orador.cidade.estado_id);
    setCidadeId(orador.cidade_id);
    setCongregacaoOrigemId(orador.congregacao_origem_id);
    setErro(null);
    setEditando(true);
  }

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
    const { error } = await editarOrador(orador, {
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefoneNormalizado,
      email: email.trim(),
      cidadeId,
      congregacaoOrigemId,
    });
    setSalvando(false);

    if (error) {
      setErro(error);
      return;
    }

    setEditando(false);
  }

  const congregacaoOpcoes = congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }));

  function selecionarCongregacao(item: { id: string; label: string }) {
    setCongregacaoOrigemId(item.id);
  }

  if (!editando) {
    return (
      <View className="gap-4">
        <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Telefone</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{formatarTelefone(orador.telefone_normalizado)}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">E-mail</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.email ?? 'Não informado'}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.cidade.nome}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Congregação de origem</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{orador.congregacao_origem.nome}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Conta</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {orador.usuario_id ? 'Conta vinculada' : 'Sem conta vinculada'}
            </Text>
          </View>
        </View>

        {podeGerenciar ? (
          <Pressable
            onPress={iniciarEdicao}
            className="items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3">
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
        value={congregacaoOrigemId}
        placeholder="Congregação de origem"
        search
        searchPlaceholder="Buscar congregação..."
        onChangeText={setCongregacaoBusca}
        onChange={selecionarCongregacao}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={congregacaoBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(congregacaoOpcoes, 'label', congregacaoBusca);
              if (primeiro) selecionarCongregacao(primeiro);
              congregacaoRef.current?.close();
            }}
            placeholder="Buscar congregação..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />

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
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function SecaoTemasPreparados({
  oradorId,
  podeGerenciar,
  colors,
}: {
  oradorId: string;
  podeGerenciar: boolean;
  colors: ReturnType<typeof useTheme>;
}) {
  const { status, temasPreparados, adicionarTemaPreparado, editarObservacoes, removerTemaPreparado } =
    useTemasPreparados(oradorId);
  const { temas } = useTemas();

  const temaParaAdicionarRef = useRef<IDropdownRef>(null);
  const [temaParaAdicionar, setTemaParaAdicionar] = useState('');
  const [temaParaAdicionarBusca, setTemaParaAdicionarBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [observacoesEmEdicao, setObservacoesEmEdicao] = useState<Record<string, string>>({});

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temasDisponiveis = useMemo(() => {
    const jaAdicionados = new Set(temasPreparados.map((tp) => tp.tema_id));
    const disponiveis = temas.filter((t) => t.ativo && !jaAdicionados.has(t.id));
    return ordenarTemasPorRelevancia(disponiveis, temaParaAdicionarBusca);
  }, [temas, temasPreparados, temaParaAdicionarBusca]);

  const temaParaAdicionarOpcoes = temasDisponiveis.map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }));

  function selecionarTemaParaAdicionar(item: { id: string; label: string }) {
    setTemaParaAdicionar(item.id);
  }

  async function handleAdicionar() {
    setErro(null);
    if (!temaParaAdicionar) return;

    setProcessando(true);
    const { error } = await adicionarTemaPreparado(temaParaAdicionar);
    setProcessando(false);

    if (error) {
      setErro(error);
      return;
    }
    setTemaParaAdicionar('');
  }

  async function handleSalvarObservacoes(tp: TemaPreparado) {
    setErro(null);
    setProcessando(true);
    const { error } = await editarObservacoes(tp, observacoesEmEdicao[tp.id] ?? tp.observacoes ?? '');
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleRemover(tp: TemaPreparado) {
    setErro(null);
    setProcessando(true);
    const { error } = await removerTemaPreparado(tp);
    setProcessando(false);
    if (error) setErro(error);
  }

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  return (
    <View className="gap-3">
      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {temasPreparados.map((tp) => (
        <View key={tp.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-base font-medium text-neutral-900 dark:text-white">
            {tp.tema.numero}. {tp.tema.titulo}
          </Text>

          {podeGerenciar ? (
            <>
              <TextInput
                value={observacoesEmEdicao[tp.id] ?? tp.observacoes ?? ''}
                onChangeText={(texto) => setObservacoesEmEdicao((atual) => ({ ...atual, [tp.id]: texto }))}
                placeholder="Observações (opcional)"
                className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => handleSalvarObservacoes(tp)}
                  disabled={processando}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Salvar observações</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRemover(tp)}
                  disabled={processando}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Remover</Text>
                </Pressable>
              </View>
            </>
          ) : tp.observacoes ? (
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{tp.observacoes}</Text>
          ) : null}
        </View>
      ))}

      {podeGerenciar ? (
        <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Dropdown
            ref={temaParaAdicionarRef}
            style={dropdownStyle}
            containerStyle={{ backgroundColor: colors.background }}
            placeholderStyle={{ color: colors.textSecondary }}
            selectedTextStyle={{ color: colors.text }}
            itemTextStyle={{ color: colors.text }}
            inputSearchStyle={{ color: colors.text }}
            activeColor={colors.backgroundSelected}
            data={temaParaAdicionarOpcoes}
            labelField="label"
            valueField="id"
            value={temaParaAdicionar}
            placeholder="Selecionar tema"
            search
            searchQuery={buscarTemaPorNumeroExato}
            searchPlaceholder="Buscar tema..."
            onChangeText={setTemaParaAdicionarBusca}
            onChange={selecionarTemaParaAdicionar}
            renderInputSearch={(onSearch) => (
              <DropdownSearchInput
                value={temaParaAdicionarBusca}
                onChangeText={onSearch}
                onSubmitPrimeiraCorrespondencia={() => {
                  const primeiro = encontrarPrimeiraCorrespondencia(
                    temaParaAdicionarOpcoes,
                    'label',
                    temaParaAdicionarBusca,
                    buscarTemaPorNumeroExato
                  );
                  if (primeiro) selecionarTemaParaAdicionar(primeiro);
                  temaParaAdicionarRef.current?.close();
                }}
                placeholder="Buscar tema..."
                placeholderTextColor={colors.textSecondary}
                color={colors.text}
              />
            )}
          />
          <Pressable
            onPress={handleAdicionar}
            disabled={processando || !temaParaAdicionar}
            className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {processando ? <ActivityIndicator /> : (
              <Text className="font-medium text-white dark:text-neutral-900">Adicionar Tema</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ oradorId }: { oradorId: string }) {
  const { status, eventos } = useHistoricoOrador(oradorId);

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  if (eventos.length === 0) {
    return (
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum evento registrado ainda.</Text>
    );
  }

  return (
    <View className="gap-3">
      {eventos.map((e) => (
        <View key={e.id} className="gap-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">{e.descricao}</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{formatarDataHora(e.criado_em)}</Text>
        </View>
      ))}
    </View>
  );
}
