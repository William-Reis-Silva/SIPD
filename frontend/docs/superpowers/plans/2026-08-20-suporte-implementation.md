# Suporte — FAQ e Chamados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar aos usuários uma tela de Suporte com FAQ fixo e um formulário para abrir chamados (1 pergunta + 1 resposta), com o Administrador Global vendo e respondendo todos os chamados.

**Architecture:** Tabela nova `suporte_mensagens` com RLS reaproveitando `is_administrador_global()` já existente no schema. Um hook único `useSuporte()` — a mesma query serve usuário comum (RLS filtra só os próprios) e Administrador Global (RLS libera todos); a tela decide o que mostrar filtrando/ordenando no client. Rota flat nova `suporte.tsx`, mesmo padrão de `temas.tsx`/`usuarios.tsx`.

**Tech Stack:** Expo Router (web + native), React Native + NativeWind, Supabase (Postgres + RLS + PostgREST), TypeScript.

**Spec:** `frontend/docs/superpowers/specs/2026-08-20-suporte-design.md`

## Global Constraints

- Chamado é 1 pergunta + 1 resposta — sem thread de várias mensagens.
- FAQ é um array fixo no código — sem tabela nem tela de edição.
- Sem framework de testes automatizados no projeto — verificação é manual: `npx tsc --noEmit`, `npx expo lint` (só conferir que os arquivos tocados não introduzem erros novos, o projeto já tem warnings pré-existentes em outros arquivos) e teste ao vivo no navegador via Playwright, logado com a conta de teste já usada nesta conversa.
- Toda tabela nova usa RLS com `public.is_administrador_global()` (função já existente) — nunca inventar checagem de perfil nova.
- Nunca fazer hard delete — sem policy de `delete` em `suporte_mensagens` (mesma convenção do resto do schema).
- `usuario_id`/`respondido_por` referenciam `public.usuarios(id)`, que por sua vez referencia `auth.users(id)` — `usuario_id = auth.uid()` é o padrão de comparação já usado em `usuarios_self_update`.

---

### Task 1: Migração de banco — tabela `suporte_mensagens`

**Files:**
- Create: `database/migrations/20260820120000_suporte_mensagens.sql`

**Interfaces:**
- Produces: tabela `public.suporte_mensagens` com colunas `id, usuario_id, assunto, mensagem, status, resposta, respondido_por, respondido_em, criado_em, atualizado_em`; policies `suporte_mensagens_select`, `suporte_mensagens_insert`, `suporte_mensagens_update`. Tasks 3+ fazem `supabase.from('suporte_mensagens')` contra essas colunas/policies.

- [ ] **Step 1: Escrever a migração**

Crie `database/migrations/20260820120000_suporte_mensagens.sql`:

```sql
-- ============================================================================
-- SIPD — Migração: Suporte (FAQ + Chamados)
-- ============================================================================
--
-- Contexto:
-- Suporte não faz parte dos UCs originais (docs/06.1.*) — escopo novo pedido
-- diretamente pelo usuário durante teste manual. Chamado é 1 pergunta + 1
-- resposta (sem thread); FAQ fica fixo no código do frontend, sem tabela
-- própria. RLS reaproveita public.is_administrador_global(), já existente.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-20-suporte-design.md
-- ============================================================================

create table public.suporte_mensagens (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios(id),
  assunto        varchar(200) not null,
  mensagem       text not null,
  status         varchar not null default 'Aberto'
                   check (status in ('Aberto', 'Respondido')),
  resposta       text,
  respondido_por uuid references public.usuarios(id),
  respondido_em  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create trigger set_atualizado_em before update on public.suporte_mensagens
  for each row execute function public.set_atualizado_em();

alter table public.suporte_mensagens enable row level security;

create policy suporte_mensagens_select on public.suporte_mensagens
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_administrador_global());

create policy suporte_mensagens_insert on public.suporte_mensagens
  for insert to authenticated
  with check (usuario_id = auth.uid());

create policy suporte_mensagens_update on public.suporte_mensagens
  for update to authenticated
  using (public.is_administrador_global())
  with check (public.is_administrador_global());
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase (`imeoyetcbjlkrxubwldv`)**

Use a ferramenta MCP `mcp__claude_ai_Supabase__apply_migration` com `project_id: imeoyetcbjlkrxubwldv`, `name: suporte_mensagens`, `query`: o conteúdo do arquivo do Step 1.

- [ ] **Step 3: Verificar a tabela e as policies**

Rode via `mcp__claude_ai_Supabase__execute_sql` (`project_id: imeoyetcbjlkrxubwldv`):

```sql
select policyname, cmd from pg_policies where tablename = 'suporte_mensagens' order by policyname;
```

Esperado: 3 linhas — `suporte_mensagens_insert` (INSERT), `suporte_mensagens_select` (SELECT), `suporte_mensagens_update` (UPDATE). Sem policy de DELETE.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/20260820120000_suporte_mensagens.sql
git commit -m "feat(suporte): criar tabela suporte_mensagens com RLS"
```

---

### Task 2: Conteúdo fixo do FAQ

**Files:**
- Create: `frontend/src/features/suporte/faq.ts`

**Interfaces:**
- Produces: `export type PerguntaFrequente = { id: string; pergunta: string; resposta: string }` e `export const PERGUNTAS_FREQUENTES: PerguntaFrequente[]`. Task 4 importa e renderiza essa lista.

- [ ] **Step 1: Criar o arquivo**

Crie `frontend/src/features/suporte/faq.ts`:

```ts
export type PerguntaFrequente = {
  id: string;
  pergunta: string;
  resposta: string;
};

export const PERGUNTAS_FREQUENTES: PerguntaFrequente[] = [
  {
    id: 'esqueci-senha',
    pergunta: 'Esqueci minha senha, o que eu faço?',
    resposta:
      'Ainda não há recuperação de senha automática pelo app. Envie uma mensagem de suporte pedindo redefinição, informando seu e-mail cadastrado, que o Administrador Global providencia.',
  },
  {
    id: 'criar-conta',
    pergunta: 'Como eu crio minha conta?',
    resposta:
      'Você precisa de um código de convite enviado por um Coordenador ou Administrador Global da sua congregação. Na tela de login, toque em "Tenho um código de convite" e preencha seus dados.',
  },
  {
    id: 'cadastrar-congregacao',
    pergunta: 'Como cadastro uma nova congregação?',
    resposta:
      'Na aba Congregação, preencha nome, número e escolha estado e cidade. Se a cidade não existir na lista, digite o nome dela no campo de busca e toque em "Cadastrar cidade" para criá-la.',
  },
  {
    id: 'convidar-usuario',
    pergunta: 'Como convido alguém para usar o sistema?',
    resposta:
      'Na aba Usuários, se você for Coordenador ou Administrador Global, use "Convites pendentes" para gerar um código, escolhendo o perfil (Editor, Leitor, etc.) da pessoa. Compartilhe o código ou o link gerado com ela.',
  },
  {
    id: 'perfis-permissoes',
    pergunta: 'Qual a diferença entre os perfis de usuário?',
    resposta:
      'Administrador Global tem acesso irrestrito a tudo. Coordenador administra tudo dentro da própria congregação. Editor faz o dia a dia (cadastra oradores, programações, convites). Leitor só consulta, sem editar nada.',
  },
  {
    id: 'cadastrar-tema',
    pergunta: 'Como cadastro um tema novo no catálogo?',
    resposta:
      'Só o Administrador Global pode cadastrar temas e categorias. Na aba Temas, toque em "Novo Tema" e preencha número, título e categoria.',
  },
  {
    id: 'cadastrar-orador',
    pergunta: 'Como cadastro um orador?',
    resposta:
      'Na aba Oradores, toque em "Novo Orador" e preencha nome, telefone, cidade e a congregação de origem dele. O telefone precisa ser único no sistema.',
  },
  {
    id: 'temas-preparados',
    pergunta: 'Como registro os temas que um orador já discursa?',
    resposta:
      'Abra o orador na aba Oradores, vá em "Temas Preparados" e toque em "Adicionar Tema" para buscar e vincular um tema do catálogo a ele.',
  },
];
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `faq.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/suporte/faq.ts
git commit -m "feat(suporte): adicionar conteúdo fixo do FAQ"
```

---

### Task 3: Hook `useSuporte`

**Files:**
- Create: `frontend/src/features/suporte/use-suporte.ts`

**Interfaces:**
- Consumes: `useAuth()` de `@/features/administracao/use-auth` (retorna `{ usuario }`, onde `usuario.id: string`, `usuario.perfil.nome: string`); `supabase` de `@/lib/supabase`.
- Produces: `export type MensagemSuporte = { id: string; usuario_id: string; assunto: string; mensagem: string; status: 'Aberto' | 'Respondido'; resposta: string | null; respondido_por: string | null; respondido_em: string | null; criado_em: string; usuario: { nome: string; sobrenome: string } | null }` e `export function useSuporte()` retornando `{ status: 'loading' | 'ready' | 'error', mensagens: MensagemSuporte[], criarMensagem: (assunto: string, mensagem: string) => Promise<{ error: string | null }>, responder: (mensagemId: string, resposta: string) => Promise<{ error: string | null }> }`. Task 4 consome esses três símbolos exatamente com esses nomes/tipos.

- [ ] **Step 1: Criar o hook**

Crie `frontend/src/features/suporte/use-suporte.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type MensagemSuporte = {
  id: string;
  usuario_id: string;
  assunto: string;
  mensagem: string;
  status: 'Aberto' | 'Respondido';
  resposta: string | null;
  respondido_por: string | null;
  respondido_em: string | null;
  criado_em: string;
  usuario: { nome: string; sobrenome: string } | null;
};

export type SuporteStatus = 'loading' | 'ready' | 'error';

const SUPORTE_SELECT =
  'id, usuario_id, assunto, mensagem, status, resposta, respondido_por, respondido_em, criado_em, ' +
  'usuario:usuarios!usuario_id(nome, sobrenome)';
const ERRO_ENVIAR = 'Não foi possível enviar sua mensagem. Tente novamente.';
const ERRO_RESPONDER = 'Não foi possível enviar a resposta. Tente novamente.';

export function useSuporte() {
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [status, setStatus] = useState<SuporteStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('suporte_mensagens')
      .select(SUPORTE_SELECT)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setMensagens((data ?? []) as unknown as MensagemSuporte[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarMensagem(assunto: string, mensagem: string): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_ENVIAR };

    const { error } = await supabase
      .from('suporte_mensagens')
      .insert({ usuario_id: usuario.id, assunto, mensagem });

    if (error) return { error: ERRO_ENVIAR };

    await carregar();
    return { error: null };
  }

  async function responder(mensagemId: string, resposta: string): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_RESPONDER };

    const { error } = await supabase
      .from('suporte_mensagens')
      .update({
        resposta,
        status: 'Respondido',
        respondido_por: usuario.id,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', mensagemId);

    if (error) return { error: ERRO_RESPONDER };

    await carregar();
    return { error: null };
  }

  return { status, mensagens, criarMensagem, responder };
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `use-suporte.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/suporte/use-suporte.ts
git commit -m "feat(suporte): adicionar hook useSuporte"
```

---

### Task 4: Tela `suporte.tsx`

**Files:**
- Create: `frontend/src/app/(app)/suporte.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`usuario.id`, `usuario.perfil.nome`); `useSuporte()`, `MensagemSuporte` de `@/features/suporte/use-suporte` (Task 3); `PERGUNTAS_FREQUENTES` de `@/features/suporte/faq` (Task 2); `MaxContentWidth` de `@/constants/theme`.
- Produces: rota `/suporte` (componente default export `SuporteScreen`). Task 5 aponta a aba de navegação pra essa rota.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/suporte.tsx`:

```tsx
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
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `suporte.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/"(app)"/suporte.tsx
git commit -m "feat(suporte): adicionar tela de Suporte (FAQ + chamados)"
```

---

### Task 5: Navegação + verificação end-to-end

**Files:**
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: rota `/suporte` produzida na Task 4.

- [ ] **Step 1: Adicionar a aba no `app-tabs.tsx` (native)**

Em `frontend/src/components/app-tabs.tsx`, depois do trigger `oradores`, adicione:

```tsx
      <NativeTabs.Trigger name="oradores">
        <NativeTabs.Trigger.Label>Oradores</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="suporte">
        <NativeTabs.Trigger.Label>Suporte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```

- [ ] **Step 2: Adicionar a aba no `app-tabs.web.tsx` (web)**

Em `frontend/src/components/app-tabs.web.tsx`, depois do `TabTrigger name="oradores"`, adicione:

```tsx
          <TabTrigger name="oradores" href="/oradores" asChild>
            <TabButton>Oradores</TabButton>
          </TabTrigger>
          <TabTrigger name="suporte" href="/suporte" asChild>
            <TabButton>Suporte</TabButton>
          </TabTrigger>
```

- [ ] **Step 3: Verificar tipos e lint**

Rode:
```bash
cd frontend
npx tsc --noEmit
npx expo lint
```
Esperado: `tsc` sem erros; `expo lint` sem erros novos nos arquivos tocados nesta feature (o projeto já tem warnings/erros pré-existentes em outros arquivos — não introduzir novos nos arquivos desta lista de "Files").

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/app-tabs.tsx frontend/src/components/app-tabs.web.tsx
git commit -m "feat(suporte): adicionar aba Suporte à navegação"
```

- [ ] **Step 5: Verificação manual ao vivo (Playwright, logado)**

Suba o servidor web (`cd frontend && npx expo start --web --port 8081`, aguardar `curl -sf http://localhost:8081` responder) e, com Playwright (ou o `chromium-cli`, se disponível), logado com a conta de teste já usada nesta conversa (Administrador Global):

1. Login → abrir `/suporte` pela aba nova.
2. Confirmar que o FAQ aparece e cada pergunta expande/recolhe ao tocar.
3. Tentar "Enviar" com assunto/mensagem vazios → mensagem de validação, sem chamada de rede.
4. Preencher assunto + mensagem e enviar → chamado aparece em "Meus chamados" com "Aguardando resposta"; formulário limpa.
5. Rolar até "Chamados de suporte" (só aparece pra Administrador Global) → o mesmo chamado aparece lá também (é a mesma conta), com o campo de resposta.
6. Responder o chamado → status muda pra "Respondido" nas duas seções, resposta aparece em "Meus chamados".
7. Checar console do navegador (`console --errors` no chromium-cli, ou `page.on('console'...)` num script Playwright) → sem erros.

Encerrar o servidor: `lsof -ti:8081 -sTCP:LISTEN | xargs -r kill`.

- [ ] **Step 6: Verificação de isolamento entre usuários (RLS)**

Via `mcp__claude_ai_Supabase__execute_sql` (`project_id: imeoyetcbjlkrxubwldv`), confirme que a policy de update realmente bloqueia quem não é Administrador Global — não dá pra simular `auth.uid()` de outro usuário por SQL direto (o `execute_sql` roda como service role, que ignora RLS), então essa checagem é sobre o **texto da policy**, não uma tentativa real:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'suporte_mensagens'
order by policyname;
```

Confirme visualmente que `suporte_mensagens_select` menciona `usuario_id = auth.uid() OR is_administrador_global()`, `suporte_mensagens_insert` menciona `usuario_id = auth.uid()`, e `suporte_mensagens_update` menciona só `is_administrador_global()` (sem branch pro dono da mensagem) — exatamente como na Task 1. Se algum desses textos não bater, a Task 1 tem um bug e precisa ser corrigida antes de seguir.

---

## Self-Review Notes

- **Cobertura da spec:** modelo de dados (Task 1), FAQ fixo (Task 2), hook (Task 3), tela com FAQ + formulário + meus chamados + seção admin (Task 4), navegação (Task 5), verificação manual (Task 5) — todas as seções da spec têm task correspondente.
- **Placeholders:** nenhum "TBD"/"similar to" — todo código de cada task está completo no próprio step.
- **Consistência de tipos:** `MensagemSuporte` (Task 3) é o mesmo tipo importado e usado em `suporte.tsx` (Task 4) sem alteração de campos; `criarMensagem`/`responder` têm a mesma assinatura em produção (Task 3) e consumo (Task 4).
