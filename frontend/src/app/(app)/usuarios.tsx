import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import * as Linking from 'expo-linking';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useUsuariosCongregacao, type UsuarioCongregacao } from '@/features/congregacoes/use-usuarios-congregacao';
import { useConvitesUsuario } from '@/features/congregacoes/use-convites-usuario';

const PODE_GERENCIAR = ['Coordenador', 'Administrador Global'];
const ERRO_PERFIL_CONVITE = 'Selecione o perfil do convite.';
const ERRO_CONVITE_GENERICO = 'Não foi possível criar o convite. Tente novamente.';

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function UsuariosScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status: statusUsuarios, usuarios, perfis, atualizarPerfil, alternarAtivo } = useUsuariosCongregacao();
  const { status: statusConvites, convites, criarConvite, cancelarConvite } = useConvitesUsuario();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarConvite, setMostrarConvite] = useState(false);
  const [perfilConviteId, setPerfilConviteId] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | null>(null);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';
  const perfisAtribuiveis = perfis.filter((p) => ehAdministradorGlobal || p.nome !== 'Administrador Global');

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  async function handleAlterarPerfil(alvo: UsuarioCongregacao, perfilId: string) {
    setErro(null);
    setSalvandoId(alvo.id);
    const { error } = await atualizarPerfil(alvo, perfilId);
    setSalvandoId(null);
    setEditandoId(null);
    if (error) setErro(error);
  }

  async function handleAlternarAtivo(alvo: UsuarioCongregacao) {
    setErro(null);
    setSalvandoId(alvo.id);
    const { error } = await alternarAtivo(alvo, !alvo.ativo);
    setSalvandoId(null);
    if (error) setErro(error);
  }

  async function handleCriarConvite() {
    setErroConvite(null);
    if (!perfilConviteId) {
      setErroConvite(ERRO_PERFIL_CONVITE);
      return;
    }

    setCriandoConvite(true);
    const { codigo, error } = await criarConvite(perfilConviteId, rotulo.trim());
    setCriandoConvite(false);

    if (error || !codigo) {
      setErroConvite(error ?? ERRO_CONVITE_GENERICO);
      return;
    }

    setCodigoGerado(codigo);
    setRotulo('');
    setPerfilConviteId('');
  }

  async function handleCompartilhar(codigo: string) {
    const link = Linking.createURL('/aceitar-convite', { queryParams: { codigo } });
    try {
      await Share.share({ message: `Convite para o SIPD: ${link}` });
    } catch {
      // Share pode não estar disponível (ex.: alguns navegadores no build
      // web) — o código já fica visível e selecionável na tela.
    }
  }

  async function handleCancelarConvite(id: string) {
    setCancelandoId(id);
    await cancelarConvite(id);
    setCancelandoId(null);
  }

  if (statusUsuarios === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (statusUsuarios === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os usuários da congregação.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
      <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Usuários</Text>

        {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

        {usuarios.map((u) => (
          <View key={u.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
            <Text className="text-base font-medium text-neutral-900 dark:text-white">
              {u.nome} {u.sobrenome}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</Text>

            {editandoId === u.id ? (
              <Dropdown
                style={dropdownStyle}
                containerStyle={{ backgroundColor: colors.background }}
                placeholderStyle={{ color: colors.textSecondary }}
                selectedTextStyle={{ color: colors.text }}
                itemTextStyle={{ color: colors.text }}
                activeColor={colors.backgroundSelected}
                data={perfisAtribuiveis.map((p) => ({ id: p.id, label: p.nome }))}
                labelField="label"
                valueField="id"
                value={u.perfil_id}
                placeholder="Selecionar perfil"
                onChange={(item) => handleAlterarPerfil(u, item.id)}
              />
            ) : (
              <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                {u.perfil.nome} · {u.ativo ? 'Ativo' : 'Inativo'}
              </Text>
            )}

            {podeGerenciar && u.id !== usuario?.id ? (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setEditandoId(editandoId === u.id ? null : u.id)}
                  disabled={salvandoId === u.id}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                    {editandoId === u.id ? 'Cancelar' : 'Editar perfil'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAlternarAtivo(u)}
                  disabled={salvandoId === u.id}
                  className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                  {salvandoId === u.id ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        {podeGerenciar ? (
          <>
            <Text className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">Convites pendentes</Text>

            {statusConvites === 'ready' && convites.length === 0 ? (
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum convite pendente.</Text>
            ) : null}

            {convites.map((c) => (
              <View key={c.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {c.rotulo || 'Sem rótulo'} · {c.perfil.nome}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  Código: {c.codigo} · Válido até {formatarData(c.expira_em)}
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => handleCompartilhar(c.codigo)}
                    className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                    <Text className="text-sm font-medium text-neutral-900 dark:text-white">Compartilhar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCancelarConvite(c.id)}
                    disabled={cancelandoId === c.id}
                    className="flex-1 items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                    {cancelandoId === c.id ? (
                      <ActivityIndicator />
                    ) : (
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}

            {mostrarConvite ? (
              <View className="mt-2 gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Dropdown
                  style={dropdownStyle}
                  containerStyle={{ backgroundColor: colors.background }}
                  placeholderStyle={{ color: colors.textSecondary }}
                  selectedTextStyle={{ color: colors.text }}
                  itemTextStyle={{ color: colors.text }}
                  activeColor={colors.backgroundSelected}
                  data={perfisAtribuiveis.map((p) => ({ id: p.id, label: p.nome }))}
                  labelField="label"
                  valueField="id"
                  value={perfilConviteId}
                  placeholder="Selecionar perfil"
                  onChange={(item) => setPerfilConviteId(item.id)}
                />
                <TextInput
                  value={rotulo}
                  onChangeText={setRotulo}
                  placeholder="Rótulo (opcional, ex.: nome da pessoa)"
                  className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
                />

                {erroConvite ? <Text className="text-sm text-red-600 dark:text-red-400">{erroConvite}</Text> : null}

                {codigoGerado ? (
                  <View className="gap-2 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                    <Text selectable className="text-base font-bold text-neutral-900 dark:text-white">
                      {codigoGerado}
                    </Text>
                    <Pressable
                      onPress={() => handleCompartilhar(codigoGerado)}
                      className="items-center rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600">
                      <Text className="text-sm font-medium text-neutral-900 dark:text-white">Compartilhar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleCriarConvite}
                    disabled={criandoConvite}
                    className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                    {criandoConvite ? (
                      <ActivityIndicator />
                    ) : (
                      <Text className="font-medium text-white dark:text-neutral-900">Gerar convite</Text>
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    setMostrarConvite(false);
                    setCodigoGerado(null);
                    setErroConvite(null);
                  }}
                  className="items-center py-2">
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">Fechar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setMostrarConvite(true)}
                className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">Convidar Usuário</Text>
              </Pressable>
            )}
          </>
        ) : null}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
