import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { MaxContentWidth } from '@/constants/theme';
import { useConvitePublico, type ConvitePublico } from '@/features/convites/use-convite-publico';
import { formatarDataIso } from '@/components/calendario-mensal';
import { AnexoUpload } from '@/components/anexo-upload';

const ERRO_CAMPOS_FASE1 = 'Escolha uma data e um tema.';
const ERRO_PERMANENCIA = 'É necessário confirmar que permanecerá até o final da reunião.';

export default function ConvitePublicoScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, convite, responderConvite, enviarConfirmacao, uploadAnexo } = useConvitePublico(token ?? '');

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
          Não foi possível carregar este convite.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth }}>
          {convite.status === 'Criado' || convite.status === 'Enviado' ? (
            <Fase1 convite={convite} responderConvite={responderConvite} />
          ) : null}

          {convite.status === 'Aceito' && convite.confirmacao_pendente ? (
            <Fase2 enviarConfirmacao={enviarConfirmacao} uploadAnexo={uploadAnexo} />
          ) : null}

          {convite.status === 'Aceito' && !convite.confirmacao_pendente ? (
            <View style={{ gap: 12 }}>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Confirmado, obrigado!</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                Já recebemos os dados do seu discurso.
              </Text>
            </View>
          ) : null}

          {convite.status === 'Recusado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Você recusou este convite. Obrigado por avisar!
            </Text>
          ) : null}

          {convite.status === 'Cancelado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Este convite foi cancelado pela congregação.
            </Text>
          ) : null}

          {convite.status === 'Expirado' ? (
            <Text className="text-lg text-neutral-900 dark:text-white">
              Este convite expirou. Peça à congregação um novo link.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fase1({
  convite,
  responderConvite,
}: {
  convite: ConvitePublico;
  responderConvite: ReturnType<typeof useConvitePublico>['responderConvite'];
}) {
  const [dataEscolhida, setDataEscolhida] = useState<string | null>(null);
  const [temaId, setTemaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleRecusar() {
    setErro(null);
    setEnviando(true);
    const { error } = await responderConvite({ recusar: true });
    setEnviando(false);
    if (error) setErro(error);
  }

  async function handleConfirmarDisponibilidade() {
    setErro(null);
    if (!dataEscolhida || !temaId) {
      setErro(ERRO_CAMPOS_FASE1);
      return;
    }
    setEnviando(true);
    const { error } = await responderConvite({ recusar: false, data: dataEscolhida, temaId });
    setEnviando(false);
    if (error) setErro(error);
  }

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Convite para Discurso Público</Text>
      <Text className="text-base text-neutral-900 dark:text-white">
        Olá, {convite.orador_nome}! A congregação {convite.congregacao_nome} gostaria de convidá-lo(a).
      </Text>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Escolha uma data:</Text>
        {convite.datas_candidatas.map((data) => (
          <Pressable
            key={data}
            onPress={() => setDataEscolhida(data)}
            className={`rounded-lg border px-4 py-3 ${dataEscolhida === data ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
            <Text className="text-neutral-900 dark:text-white">{formatarDataIso(data)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Escolha um tema preparado:</Text>
        {(convite.temas_disponiveis ?? []).length === 0 ? (
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum tema preparado disponível no momento.
          </Text>
        ) : (
          (convite.temas_disponiveis ?? []).map((tema) => (
            <Pressable
              key={tema.tema_id}
              onPress={() => setTemaId(tema.tema_id)}
              className={`rounded-lg border px-4 py-3 ${temaId === tema.tema_id ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-neutral-900 dark:text-white">
                {tema.numero}. {tema.titulo}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <Pressable
        onPress={handleConfirmarDisponibilidade}
        disabled={enviando}
        className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
        {enviando ? (
          <ActivityIndicator />
        ) : (
          <Text className="font-medium text-white dark:text-neutral-900">Confirmar disponibilidade</Text>
        )}
      </Pressable>

      <Pressable
        onPress={handleRecusar}
        disabled={enviando}
        className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
        <Text className="text-sm font-medium text-red-600 dark:text-red-400">Não posso nenhuma dessas datas</Text>
      </Pressable>
    </View>
  );
}

function Fase2({
  enviarConfirmacao,
  uploadAnexo,
}: {
  enviarConfirmacao: ReturnType<typeof useConvitePublico>['enviarConfirmacao'];
  uploadAnexo: ReturnType<typeof useConvitePublico>['uploadAnexo'];
}) {
  const [adiado, setAdiado] = useState(false);
  const [canticoInicial, setCanticoInicial] = useState('');
  const [utilizaraImagens, setUtilizaraImagens] = useState(false);
  const [permanecereAteFinal, setPermanecereAteFinal] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [anexos, setAnexos] = useState<{ caminho: string; nome_arquivo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleAnexar(arquivos: File[]) {
    for (const arquivo of arquivos) {
      const { error, caminho } = await uploadAnexo(arquivo);
      if (!error && caminho) setAnexos((atual) => [...atual, { caminho, nome_arquivo: arquivo.name }]);
    }
  }

  function handleRemoverAnexo(caminho: string) {
    setAnexos((atual) => atual.filter((a) => a.caminho !== caminho));
  }

  async function handleEnviar() {
    setErro(null);
    if (!permanecereAteFinal) {
      setErro(ERRO_PERMANENCIA);
      return;
    }
    setEnviando(true);
    const { error } = await enviarConfirmacao({
      canticoInicial,
      utilizaraImagens,
      permanecereAteFinal,
      observacoes,
      anexos,
    });
    setEnviando(false);
    if (error) setErro(error);
  }

  if (adiado) {
    return (
      <View style={{ gap: 12 }}>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white">Tudo certo por enquanto!</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          Você pode voltar a este mesmo link quando quiser terminar de enviar os dados do discurso.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Dados do Discurso</Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">
        Convite aceito! Agora precisamos de mais alguns detalhes.
      </Text>

      <TextInput
        value={canticoInicial}
        onChangeText={setCanticoInicial}
        placeholder="Cântico inicial (opcional)"
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      <Pressable onPress={() => setUtilizaraImagens(!utilizaraImagens)} className="flex-row items-center gap-2">
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${utilizaraImagens ? 'bg-neutral-900 dark:bg-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
          {utilizaraImagens ? <Text className="text-xs text-white dark:text-neutral-900">✓</Text> : null}
        </View>
        <Text className="text-sm text-neutral-900 dark:text-white">Vou utilizar imagens no discurso</Text>
      </Pressable>

      <View style={{ gap: 8 }}>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Anexos (opcional)</Text>
        <AnexoUpload onArquivosSelecionados={handleAnexar} />
        {anexos.map((anexo) => (
          <View
            key={anexo.caminho}
            className="flex-row items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <Text className="flex-1 text-sm text-neutral-900 dark:text-white" numberOfLines={1}>
              {anexo.nome_arquivo}
            </Text>
            <Pressable onPress={() => handleRemoverAnexo(anexo.caminho)}>
              <Text className="text-sm text-red-600 dark:text-red-400">Remover</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <TextInput
        value={observacoes}
        onChangeText={setObservacoes}
        placeholder="Observações (opcional)"
        multiline
        numberOfLines={3}
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      <Pressable onPress={() => setPermanecereAteFinal(!permanecereAteFinal)} className="flex-row items-center gap-2">
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${permanecereAteFinal ? 'bg-neutral-900 dark:bg-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
          {permanecereAteFinal ? <Text className="text-xs text-white dark:text-neutral-900">✓</Text> : null}
        </View>
        <Text className="text-sm text-neutral-900 dark:text-white">Confirmo que permanecerei até o final da reunião</Text>
      </Pressable>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <Pressable
        onPress={handleEnviar}
        disabled={enviando}
        className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
        {enviando ? (
          <ActivityIndicator />
        ) : (
          <Text className="font-medium text-white dark:text-neutral-900">Enviar confirmação</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setAdiado(true)}
        className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Responder depois</Text>
      </Pressable>
    </View>
  );
}
