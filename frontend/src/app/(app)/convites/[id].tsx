import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { useConvites, type Convite } from '@/features/convites/use-convites';
import { useHistoricoConvite } from '@/features/convites/use-historico-convite';
import { formatarDataIso } from '@/components/calendario-mensal';
import { supabase } from '@/lib/supabase';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

type Secao = 'dados' | 'historico';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function construirLinkConvite(token: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/convite/${token}`;
  }
  return `/convite/${token}`;
}

export default function ConviteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const { status, convites, enviarConvite, reenviarConvite, cancelarConvite } = useConvites();
  const convite = convites.find((c) => c.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');
  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !convite) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os convites.
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
            {convite.orador.nome} {convite.orador.sobrenome}
          </Text>

          <View className="flex-row gap-3">
            {(['dados', 'historico'] as Secao[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSecao(s)}
                className={`flex-1 items-center rounded-lg border px-3 py-2 ${secao === s ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {s === 'dados' ? 'Dados' : 'Histórico'}
                </Text>
              </Pressable>
            ))}
          </View>

          {secao === 'dados' ? (
            <SecaoDados
              convite={convite}
              podeGerenciar={podeGerenciar}
              enviarConvite={enviarConvite}
              reenviarConvite={reenviarConvite}
              cancelarConvite={cancelarConvite}
            />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico conviteId={convite.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  convite,
  podeGerenciar,
  enviarConvite,
  reenviarConvite,
  cancelarConvite,
}: {
  convite: Convite;
  podeGerenciar: boolean;
  enviarConvite: ReturnType<typeof useConvites>['enviarConvite'];
  reenviarConvite: ReturnType<typeof useConvites>['reenviarConvite'];
  cancelarConvite: ReturnType<typeof useConvites>['cancelarConvite'];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const link = construirLinkConvite(convite.token);
  const podeEnviar = podeGerenciar && convite.status === 'Criado';
  const podeReenviar = podeGerenciar && (convite.status === 'Enviado' || convite.status === 'Expirado');
  const podeCancelar = podeGerenciar && !['Recusado', 'Cancelado', 'Expirado'].includes(convite.status);
  const aceitoSemConfirmacao = convite.status === 'Aceito' && convite.confirmacoes.length === 0;
  const confirmacao = convite.confirmacoes[0] ?? null;

  async function handleCopiar() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  async function handleEnviar() {
    setErro(null);
    setProcessando(true);
    const { error } = await enviarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleReenviar() {
    setErro(null);
    setProcessando(true);
    const { error } = await reenviarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleCancelar() {
    setErro(null);
    setProcessando(true);
    const { error } = await cancelarConvite(convite);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleAbrirAnexo(caminho: string) {
    setErro(null);
    const { data, error } = await supabase.storage.from('convite-anexos').createSignedUrl(caminho, 300);
    if (error || !data?.signedUrl) {
      setErro('Não foi possível abrir o anexo.');
      return;
    }
    Linking.openURL(data.signedUrl);
  }

  return (
    <View className="gap-4">
      <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Status</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {convite.status}
            {aceitoSemConfirmacao ? ' — dados pendentes' : ''}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Datas candidatas</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {convite.convite_datas.map((d) => formatarDataIso(d.data)).join(', ')}
          </Text>
        </View>
        {convite.programacao ? (
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Data e tema confirmados</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {formatarDataIso(convite.programacao.data)} · {convite.programacao.tema.numero}.{' '}
              {convite.programacao.tema.titulo}
            </Text>
          </View>
        ) : null}
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Link de resposta</Text>
          <Text className="text-sm text-neutral-900 dark:text-white" selectable>
            {link}
          </Text>
          <Pressable onPress={handleCopiar} className="mt-2 items-start">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">
              {copiado ? 'Copiado!' : 'Copiar link'}
            </Text>
          </Pressable>
        </View>
      </View>

      {confirmacao ? (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Confirmação recebida</Text>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Cântico inicial</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.cantico_inicial || 'Não informado'}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Uso de imagens</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.utilizara_imagens ? 'Sim' : 'Não'}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Permanência até o final</Text>
            <Text className="text-base text-neutral-900 dark:text-white">
              {confirmacao.permanecera_ate_final ? 'Confirmada' : 'Não confirmada'}
            </Text>
          </View>
          {confirmacao.observacoes ? (
            <View>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Observações</Text>
              <Text className="text-base text-neutral-900 dark:text-white">{confirmacao.observacoes}</Text>
            </View>
          ) : null}
          {confirmacao.anexos.length > 0 ? (
            <View>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Anexos</Text>
              {confirmacao.anexos.map((anexo) => (
                <Pressable key={anexo.caminho} onPress={() => handleAbrirAnexo(anexo.caminho)}>
                  <Text className="text-sm font-medium text-neutral-900 underline dark:text-white">
                    {anexo.nome_arquivo}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {podeEnviar ? (
        <Pressable
          onPress={handleEnviar}
          disabled={processando}
          className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Enviar</Text>
          )}
        </Pressable>
      ) : null}

      {podeReenviar ? (
        <Pressable
          onPress={handleReenviar}
          disabled={processando}
          className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Reenviar</Text>
          )}
        </Pressable>
      ) : null}

      {podeCancelar ? (
        <Pressable
          onPress={handleCancelar}
          disabled={processando}
          className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Cancelar Convite</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ conviteId }: { conviteId: string }) {
  const { status, eventos } = useHistoricoConvite(conviteId);

  if (status === 'loading') {
    return <ActivityIndicator />;
  }

  if (eventos.length === 0) {
    return <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum evento registrado ainda.</Text>;
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
