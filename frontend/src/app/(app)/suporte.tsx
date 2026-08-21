import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { useSuporte, type MensagemSuporte } from '@/features/suporte/use-suporte';
import { PERGUNTAS_FREQUENTES } from '@/features/suporte/faq';

const ERRO_CAMPOS = 'Preencha o assunto e a mensagem.';

export default function SuporteScreen() {
  const { usuario } = useAuth();
  const { status, mensagens, criarMensagem, responder } = useSuporte();

  const [perguntaAbertaId, setPerguntaAbertaId] = useState<string | null>(null);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';
  const meusChamados = mensagens.filter((m) => m.usuario_id === usuario?.id);
  const chamadosAdmin = [...mensagens].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'Aberto' ? -1 : 1;
  });

  async function handleEnviar() {
    setErro(null);
    if (!assunto.trim() || !mensagem.trim()) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setEnviando(true);
    const { error } = await criarMensagem(assunto.trim(), mensagem.trim());
    setEnviando(false);

    if (error) {
      setErro(error);
      return;
    }

    setAssunto('');
    setMensagem('');
  }

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar os chamados.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Suporte</Text>

          <Text className="text-lg font-bold text-neutral-900 dark:text-white">Perguntas frequentes</Text>
          {PERGUNTAS_FREQUENTES.map((p) => {
            const aberta = perguntaAbertaId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPerguntaAbertaId(aberta ? null : p.id)}
                className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-base font-medium text-neutral-900 dark:text-white">{p.pergunta}</Text>
                {aberta ? (
                  <Text className="text-sm text-neutral-600 dark:text-neutral-300">{p.resposta}</Text>
                ) : null}
              </Pressable>
            );
          })}

          <Text className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">Enviar mensagem</Text>
          <TextInput
            value={assunto}
            onChangeText={setAssunto}
            placeholder="Assunto"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          <TextInput
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Descreva sua dúvida ou problema"
            multiline
            numberOfLines={4}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
          />
          {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}
          <Pressable
            onPress={handleEnviar}
            disabled={enviando}
            className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
            {enviando ? (
              <ActivityIndicator />
            ) : (
              <Text className="font-medium text-white dark:text-neutral-900">Enviar</Text>
            )}
          </Pressable>

          <Text className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">Meus chamados</Text>
          {meusChamados.length === 0 ? (
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum chamado enviado ainda.</Text>
          ) : null}
          {meusChamados.map((m) => (
            <View key={m.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
              <Text className="text-base font-medium text-neutral-900 dark:text-white">{m.assunto}</Text>
              <Text className="text-sm text-neutral-600 dark:text-neutral-300">{m.mensagem}</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {m.status === 'Aberto' ? 'Aguardando resposta' : 'Respondido'}
              </Text>
              {m.resposta ? (
                <View className="mt-1 gap-1 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                  <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Resposta do suporte
                  </Text>
                  <Text className="text-sm text-neutral-900 dark:text-white">{m.resposta}</Text>
                </View>
              ) : null}
            </View>
          ))}

          {ehAdministradorGlobal ? <SecaoChamadosAdmin chamados={chamadosAdmin} responder={responder} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoChamadosAdmin({
  chamados,
  responder,
}: {
  chamados: MensagemSuporte[];
  responder: (mensagemId: string, resposta: string) => Promise<{ error: string | null }>;
}) {
  const [respostasEmEdicao, setRespostasEmEdicao] = useState<Record<string, string>>({});
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleResponder(mensagem: MensagemSuporte) {
    const resposta = (respostasEmEdicao[mensagem.id] ?? '').trim();
    if (!resposta) return;

    setErro(null);
    setEnviandoId(mensagem.id);
    const { error } = await responder(mensagem.id, resposta);
    setEnviandoId(null);

    if (error) {
      setErro(error);
      return;
    }

    setRespostasEmEdicao((atual) => ({ ...atual, [mensagem.id]: '' }));
  }

  return (
    <View className="mt-4 gap-3">
      <Text className="text-lg font-bold text-neutral-900 dark:text-white">Chamados de suporte</Text>
      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}
      {chamados.length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum chamado registrado.</Text>
      ) : null}
      {chamados.map((m) => (
        <View key={m.id} className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <Text className="text-base font-medium text-neutral-900 dark:text-white">{m.assunto}</Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {m.usuario ? `${m.usuario.nome} ${m.usuario.sobrenome}` : 'Usuário desconhecido'} ·{' '}
            {m.status === 'Aberto' ? 'Aberto' : 'Respondido'}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-300">{m.mensagem}</Text>

          {m.status === 'Respondido' ? (
            <View className="mt-1 gap-1 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
              <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sua resposta</Text>
              <Text className="text-sm text-neutral-900 dark:text-white">{m.resposta}</Text>
            </View>
          ) : (
            <>
              <TextInput
                value={respostasEmEdicao[m.id] ?? ''}
                onChangeText={(texto) => setRespostasEmEdicao((atual) => ({ ...atual, [m.id]: texto }))}
                placeholder="Escrever resposta"
                multiline
                numberOfLines={3}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
              />
              <Pressable
                onPress={() => handleResponder(m)}
                disabled={enviandoId === m.id}
                className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
                {enviandoId === m.id ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-medium text-white dark:text-neutral-900">Responder</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
