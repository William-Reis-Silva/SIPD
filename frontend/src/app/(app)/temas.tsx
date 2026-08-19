import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useCategorias, type Categoria } from '@/features/catalogo/use-categorias';
import { useTemas, type Tema } from '@/features/catalogo/use-temas';

const ERRO_CAMPOS_TEMA = 'Preencha número, título e categoria.';
const ERRO_CAMPOS_CATEGORIA = 'Preencha o nome da categoria.';

type Aba = 'temas' | 'categorias';

export default function TemasScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status: statusCategorias, categorias, criarCategoria, editarCategoria } = useCategorias();
  const { status: statusTemas, temas, criarTema, editarTema } = useTemas();

  const [aba, setAba] = useState<Aba>('temas');
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  const [editandoTemaId, setEditandoTemaId] = useState<string | null>(null);
  const [novoTemaNumero, setNovoTemaNumero] = useState('');
  const [novoTemaTitulo, setNovoTemaTitulo] = useState('');
  const [novoTemaCategoriaId, setNovoTemaCategoriaId] = useState('');
  const [mostrarNovoTema, setMostrarNovoTema] = useState(false);
  const [erroTema, setErroTema] = useState<string | null>(null);
  const [salvandoTema, setSalvandoTema] = useState(false);

  const [editandoCategoriaId, setEditandoCategoriaId] = useState<string | null>(null);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [mostrarNovaCategoria, setMostrarNovaCategoria] = useState(false);
  const [erroCategoria, setErroCategoria] = useState<string | null>(null);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temasFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    const buscaEhNumero = /^\d+$/.test(buscaNormalizada);

    const filtrados = temas.filter((t) => {
      if (categoriaFiltro && t.categoria_id !== categoriaFiltro) return false;
      if (!buscaNormalizada) return true;
      if (buscaEhNumero) {
        return t.numero.toLowerCase() === buscaNormalizada;
      }
      return t.titulo.toLowerCase().includes(buscaNormalizada);
    });

    if (!buscaNormalizada || buscaEhNumero) return filtrados;

    return [...filtrados].sort((a, b) => {
      const aComeca = a.titulo.toLowerCase().startsWith(buscaNormalizada);
      const bComeca = b.titulo.toLowerCase().startsWith(buscaNormalizada);
      if (aComeca === bComeca) return 0;
      return aComeca ? -1 : 1;
    });
  }, [temas, busca, categoriaFiltro]);

  function handleVerTemasDaCategoria(categoriaId: string) {
    setCategoriaFiltro(categoriaId);
    setAba('temas');
  }

  async function handleCriarTema() {
    setErroTema(null);
    if (!novoTemaNumero.trim() || !novoTemaTitulo.trim() || !novoTemaCategoriaId) {
      setErroTema(ERRO_CAMPOS_TEMA);
      return;
    }

    setSalvandoTema(true);
    const { error } = await criarTema(novoTemaNumero.trim(), novoTemaTitulo.trim(), novoTemaCategoriaId);
    setSalvandoTema(false);

    if (error) {
      setErroTema(error);
      return;
    }

    setNovoTemaNumero('');
    setNovoTemaTitulo('');
    setNovoTemaCategoriaId('');
    setMostrarNovoTema(false);
  }

  async function handleEditarTema(tema: Tema, dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }) {
    setErroTema(null);
    setSalvandoTema(true);
    const { error } = await editarTema(tema, dados);
    setSalvandoTema(false);

    if (error) {
      setErroTema(error);
      return;
    }

    setEditandoTemaId(null);
  }

  async function handleCriarCategoria() {
    setErroCategoria(null);
    if (!novaCategoriaNome.trim()) {
      setErroCategoria(ERRO_CAMPOS_CATEGORIA);
      return;
    }

    setSalvandoCategoria(true);
    const { error } = await criarCategoria(novaCategoriaNome.trim());
    setSalvandoCategoria(false);

    if (error) {
      setErroCategoria(error);
      return;
    }

    setNovaCategoriaNome('');
    setMostrarNovaCategoria(false);
  }

  async function handleEditarCategoria(categoria: Categoria, dados: { nome: string; ativo: boolean }) {
    setErroCategoria(null);
    setSalvandoCategoria(true);
    const { error } = await editarCategoria(categoria, dados);
    setSalvandoCategoria(false);

    if (error) {
      setErroCategoria(error);
      return;
    }

    setEditandoCategoriaId(null);
  }

  const carregando = statusCategorias === 'loading' || statusTemas === 'loading';
  const comErro = statusCategorias === 'error' || statusTemas === 'error';

  if (carregando) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (comErro) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar o catálogo.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
      <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Temas</Text>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => setAba('temas')}
            className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'temas' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Temas</Text>
          </Pressable>
          <Pressable
            onPress={() => setAba('categorias')}
            className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'categorias' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Categorias</Text>
          </Pressable>
        </View>

        {aba === 'temas' ? (
          <>
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por número ou título"
              className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
            />

            {categoriaFiltro ? (
              <Pressable onPress={() => setCategoriaFiltro(null)} className="items-start">
                <Text className="text-sm text-neutral-500 underline dark:text-neutral-400">
                  Filtrando por categoria · limpar filtro
                </Text>
              </Pressable>
            ) : null}

            {erroTema ? <Text className="text-sm text-red-600 dark:text-red-400">{erroTema}</Text> : null}

            {temasFiltrados.map((t) => (
              <View key={t.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-base font-medium text-neutral-900 dark:text-white">
                  {t.numero}. {t.titulo}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t.categoria?.nome ?? 'Categoria indisponível'}
                  {ehAdministradorGlobal && !t.ativo ? ' · Inativo' : ''}
                </Text>

                {ehAdministradorGlobal ? (
                  editandoTemaId === t.id ? (
                    <EditarTemaForm
                      tema={t}
                      categorias={categorias}
                      colors={colors}
                      dropdownStyle={dropdownStyle}
                      salvando={salvandoTema}
                      onSalvar={(dados) => handleEditarTema(t, dados)}
                      onCancelar={() => setEditandoTemaId(null)}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setEditandoTemaId(t.id)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))}

            {ehAdministradorGlobal ? (
              mostrarNovoTema ? (
                <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <TextInput
                    value={novoTemaNumero}
                    onChangeText={setNovoTemaNumero}
                    placeholder="Número"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <TextInput
                    value={novoTemaTitulo}
                    onChangeText={setNovoTemaTitulo}
                    placeholder="Título"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <Dropdown
                    style={dropdownStyle}
                    containerStyle={{ backgroundColor: colors.background }}
                    placeholderStyle={{ color: colors.textSecondary }}
                    selectedTextStyle={{ color: colors.text }}
                    itemTextStyle={{ color: colors.text }}
                    activeColor={colors.backgroundSelected}
                    data={categorias.map((c) => ({ id: c.id, label: c.nome }))}
                    labelField="label"
                    valueField="id"
                    value={novoTemaCategoriaId}
                    placeholder="Selecionar categoria"
                    onChange={(item) => setNovoTemaCategoriaId(item.id)}
                  />
                  <Pressable
                    onPress={handleCriarTema}
                    disabled={salvandoTema}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {salvandoTema ? <ActivityIndicator /> : (
                      <Text className="font-medium text-white dark:text-neutral-900">Salvar Tema</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setMostrarNovoTema(false)} className="items-center py-2">
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setMostrarNovoTema(true)}
                  className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Novo Tema</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : (
          <>
            {erroCategoria ? <Text className="text-sm text-red-600 dark:text-red-400">{erroCategoria}</Text> : null}

            {categorias.map((c) => (
              <View key={c.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Pressable onPress={() => handleVerTemasDaCategoria(c.id)}>
                  <Text className="text-base font-medium text-neutral-900 dark:text-white">{c.nome}</Text>
                  {ehAdministradorGlobal && !c.ativo ? (
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">Inativo</Text>
                  ) : null}
                </Pressable>

                {ehAdministradorGlobal ? (
                  editandoCategoriaId === c.id ? (
                    <EditarCategoriaForm
                      categoria={c}
                      salvando={salvandoCategoria}
                      onSalvar={(dados) => handleEditarCategoria(c, dados)}
                      onCancelar={() => setEditandoCategoriaId(null)}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setEditandoCategoriaId(c.id)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))}

            {ehAdministradorGlobal ? (
              mostrarNovaCategoria ? (
                <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <TextInput
                    value={novaCategoriaNome}
                    onChangeText={setNovaCategoriaNome}
                    placeholder="Nome"
                    className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                  />
                  <Pressable
                    onPress={handleCriarCategoria}
                    disabled={salvandoCategoria}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {salvandoCategoria ? <ActivityIndicator /> : (
                      <Text className="font-medium text-white dark:text-neutral-900">Salvar Categoria</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => setMostrarNovaCategoria(false)} className="items-center py-2">
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setMostrarNovaCategoria(true)}
                  className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">Nova Categoria</Text>
                </Pressable>
              )
            ) : null}
          </>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditarTemaForm({
  tema,
  categorias,
  colors,
  dropdownStyle,
  salvando,
  onSalvar,
  onCancelar,
}: {
  tema: Tema;
  categorias: Categoria[];
  colors: ReturnType<typeof useTheme>;
  dropdownStyle: object;
  salvando: boolean;
  onSalvar: (dados: { numero: string; titulo: string; categoriaId: string; ativo: boolean }) => void;
  onCancelar: () => void;
}) {
  const [numero, setNumero] = useState(tema.numero);
  const [titulo, setTitulo] = useState(tema.titulo);
  const [categoriaId, setCategoriaId] = useState(tema.categoria_id);
  const [ativo, setAtivo] = useState(tema.ativo);

  return (
    <View className="gap-3">
      <TextInput
        value={numero}
        onChangeText={setNumero}
        placeholder="Número"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <TextInput
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Título"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <Dropdown
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={categorias.map((c) => ({ id: c.id, label: c.nome }))}
        labelField="label"
        valueField="id"
        value={categoriaId}
        placeholder="Selecionar categoria"
        onChange={(item) => setCategoriaId(item.id)}
      />
      <Pressable
        onPress={() => setAtivo(!ativo)}
        className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">{ativo ? 'Desativar' : 'Ativar'}</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onSalvar({ numero, titulo, categoriaId, ativo })}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
        <Pressable onPress={onCancelar} className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditarCategoriaForm({
  categoria,
  salvando,
  onSalvar,
  onCancelar,
}: {
  categoria: Categoria;
  salvando: boolean;
  onSalvar: (dados: { nome: string; ativo: boolean }) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(categoria.nome);
  const [ativo, setAtivo] = useState(categoria.ativo);

  return (
    <View className="gap-3">
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />
      <Pressable
        onPress={() => setAtivo(!ativo)}
        className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">{ativo ? 'Desativar' : 'Ativar'}</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onSalvar({ nome, ativo })}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? <ActivityIndicator /> : <Text className="font-medium text-white dark:text-neutral-900">Salvar</Text>}
        </Pressable>
        <Pressable onPress={onCancelar} className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}
