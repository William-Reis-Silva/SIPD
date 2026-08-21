# Programações — Agenda, Calendário, Criar/Editar/Cancelar/Confirmar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar aos usuários uma tela de Programações com Agenda (lista) e Calendário, permitindo a Editor/Coordenador/Administrador Global criar, editar, cancelar e confirmar a realização de uma Programação, com histórico de eventos por programação.

**Architecture:** `programacoes`, `convites`, `confirmacoes` já existem com RLS já correta (baseada em `is_administrador_global()`/`is_coordenador_ou_editor()`), então só uma correção de constraint é necessária no banco. Um hook único `useProgramacoes()` busca tudo que a RLS libera (própria congregação, ou todas para Administrador Global) e a tela filtra/agrupa no client — mesmo padrão já usado em Oradores/Suporte. Um componente novo `CalendarioMensal` (grade de mês pura, sem lib) é reaproveitado tanto na visão de Calendário quanto como seletor de data nos formulários. Um `ProgramacaoForm` compartilhado evita duplicar os três dropdowns (congregação/tema/orador) entre criar e editar.

**Tech Stack:** Expo Router (web + native), React Native + NativeWind, Supabase (Postgres + RLS + PostgREST), TypeScript, `react-native-element-dropdown` (já usado no projeto).

**Spec:** `frontend/docs/superpowers/specs/2026-08-20-programacoes-agenda-calendario-design.md`

## Global Constraints

- Trabalhar com o conteúdo de RN-050 a RN-055 (não RN-040 a RN-044, que `06.1.5` referencia por engano — ver spec, "Contexto").
- Esta fatia só produz as transições de status `Planejada` → `Cancelada` ou `Planejada` → `Realizada`. `Convite Enviado`/`Confirmada`/`Arquivada` ficam fora de escopo (ver spec, "Não-objetivos").
- Sem Convites nesta fatia — nenhuma leitura/escrita em `convites`/`confirmacoes`.
- Sem diálogo de confirmação em nenhuma ação — não existe esse padrão em nenhuma tela do app hoje (verificado: nenhum uso de `Alert.alert`/`Modal`/`window.confirm` em `frontend/src`). Ações executam direto no toque.
- `historicos.usuario_id` fica sempre `null` nos logs desta fatia (não guarda "quem executou" em nenhum hook existente — ver spec, "Convenção de Histórico"). Usar sempre `historicos.programacao_id` (coluna própria, não `dados->>'x_id'`).
- Sem framework de testes automatizado — verificação manual: `npx tsc --noEmit`, `npx expo lint` (só conferir que os arquivos tocados não introduzem erros novos) e teste ao vivo no navegador via Playwright, logado com a conta de teste já usada nesta conversa.
- Nunca fazer hard delete — cancelar é uma mudança de status, não uma exclusão.

---

### Task 1: Migração de banco — índice único condicional (RN-051)

**Files:**
- Create: `database/migrations/20260820130000_programacoes_indice_data_ativa.sql`

**Interfaces:**
- Produces: substitui a constraint `programacoes_congregacao_data_key` (UNIQUE simples) por um índice único parcial `programacoes_congregacao_data_ativa_key` que ignora linhas com `status = 'Cancelada'`. Tasks seguintes fazem `insert`/`update` em `programacoes` contando com esse comportamento (uma programação cancelada não bloqueia reuso da data).

- [ ] **Step 1: Escrever a migração**

Crie `database/migrations/20260820130000_programacoes_indice_data_ativa.sql`:

```sql
-- ============================================================================
-- SIPD — Migração: Programações — índice único condicional (RN-051)
-- ============================================================================
--
-- Contexto:
-- programacoes já existe (20260812130000_replace_prototype_with_der_schema.sql)
-- com UNIQUE (congregacao_id, data) sem exceção para status Cancelada. RN-051
-- fala em programação ATIVA — cancelar e remarcar na mesma data hoje falha
-- por violação de unicidade. Corrige para um índice único parcial.
--
-- Fontes: frontend/docs/superpowers/specs/2026-08-20-programacoes-agenda-calendario-design.md
-- ============================================================================

alter table public.programacoes drop constraint programacoes_congregacao_data_key;

create unique index programacoes_congregacao_data_ativa_key
  on public.programacoes (congregacao_id, data)
  where status <> 'Cancelada';
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase (`imeoyetcbjlkrxubwldv`)**

Use `mcp__claude_ai_Supabase__apply_migration` com `project_id: imeoyetcbjlkrxubwldv`, `name: programacoes_indice_data_ativa`, `query`: o conteúdo do arquivo do Step 1.

- [ ] **Step 3: Verificar a constraint antiga sumiu e o índice novo existe**

Rode via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select conname from pg_constraint where conrelid = 'public.programacoes'::regclass and contype = 'u';
select indexname, indexdef from pg_indexes where tablename = 'programacoes' and indexname = 'programacoes_congregacao_data_ativa_key';
```

Esperado: a primeira query não retorna `programacoes_congregacao_data_key`; a segunda retorna uma linha com `WHERE ((status)::text <> 'Cancelada'::text)` no `indexdef`.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/20260820130000_programacoes_indice_data_ativa.sql
git commit -m "fix(programacoes): tornar unicidade de data condicional a status ativo"
```

---

### Task 2: Componente `CalendarioMensal`

**Files:**
- Create: `frontend/src/components/calendario-mensal.tsx`

**Interfaces:**
- Consumes: `useTheme()` de `@/hooks/use-theme`.
- Produces: `export type CalendarioMensalProps = { ano: number; mes: number; diasComEvento?: Set<string>; diaSelecionado?: string | null; onSelecionarDia: (dataIso: string) => void; onMudarMes: (ano: number, mes: number) => void }`; `export function CalendarioMensal(props: CalendarioMensalProps)`; `export function formatarDataIso(dataIso: string): string` (`'YYYY-MM-DD'` → `'DD/MM/YYYY'`). Tasks 5, 6, 7, 8 importam esses três símbolos.

- [ ] **Step 1: Criar o componente**

Crie `frontend/src/components/calendario-mensal.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export type CalendarioMensalProps = {
  ano: number;
  mes: number;
  diasComEvento?: Set<string>;
  diaSelecionado?: string | null;
  onSelecionarDia: (dataIso: string) => void;
  onMudarMes: (ano: number, mes: number) => void;
};

export function formatarDataIso(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function paraIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function gerarSemanas(ano: number, mes: number): (number | null)[][] {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push(celulas.slice(i, i + 7));
  }
  return semanas;
}

export function CalendarioMensal({
  ano,
  mes,
  diasComEvento,
  diaSelecionado,
  onSelecionarDia,
  onMudarMes,
}: CalendarioMensalProps) {
  const colors = useTheme();
  const semanas = gerarSemanas(ano, mes);

  function irParaMesAnterior() {
    if (mes === 0) onMudarMes(ano - 1, 11);
    else onMudarMes(ano, mes - 1);
  }

  function irParaProximoMes() {
    if (mes === 11) onMudarMes(ano + 1, 0);
    else onMudarMes(ano, mes + 1);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.cabecalho}>
        <Pressable onPress={irParaMesAnterior} hitSlop={8}>
          <Text style={{ fontSize: 18, color: colors.text }}>‹</Text>
        </Pressable>
        <Text style={{ fontWeight: '600', color: colors.text }}>
          {MESES[mes]} {ano}
        </Text>
        <Pressable onPress={irParaProximoMes} hitSlop={8}>
          <Text style={{ fontSize: 18, color: colors.text }}>›</Text>
        </Pressable>
      </View>

      <View style={styles.linha}>
        {DIAS_SEMANA.map((rotulo, indice) => (
          <View key={indice} style={styles.celula}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>{rotulo}</Text>
          </View>
        ))}
      </View>

      {semanas.map((semana, indiceSemana) => (
        <View key={indiceSemana} style={styles.linha}>
          {semana.map((dia, indiceDia) => {
            if (dia === null) return <View key={indiceDia} style={styles.celula} />;

            const dataIso = paraIso(ano, mes, dia);
            const temEvento = diasComEvento?.has(dataIso) ?? false;
            const selecionado = diaSelecionado === dataIso;

            return (
              <Pressable
                key={indiceDia}
                onPress={() => onSelecionarDia(dataIso)}
                style={[
                  styles.celula,
                  styles.diaCelula,
                  selecionado ? { backgroundColor: colors.backgroundSelected } : null,
                ]}>
                <Text style={{ color: colors.text }}>{dia}</Text>
                {temEvento ? <View style={[styles.marcador, { backgroundColor: colors.text }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  linha: {
    flexDirection: 'row',
  },
  celula: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  diaCelula: {
    borderRadius: 8,
  },
  marcador: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `calendario-mensal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/calendario-mensal.tsx
git commit -m "feat(programacoes): adicionar componente CalendarioMensal"
```

---

### Task 3: Hook `useProgramacoes`

**Files:**
- Create: `frontend/src/features/programacoes/use-programacoes.ts`

**Interfaces:**
- Consumes: `useAuth()` (`usuario.id`); `supabase` de `@/lib/supabase`.
- Produces: `export type Programacao = { id: string; congregacao_id: string; congregacao: { id: string; nome: string; numero: string }; tema_id: string; tema: { id: string; numero: string; titulo: string; categoria: { id: string; nome: string } | null }; orador_id: string; orador: { id: string; nome: string; sobrenome: string }; data: string; status: 'Planejada' | 'Convite Enviado' | 'Confirmada' | 'Realizada' | 'Cancelada' | 'Arquivada'; observacoes: string | null; criado_por: string }`; `export type ProgramacaoInput = { data: string; congregacaoId: string; temaId: string; oradorId: string; observacoes: string }`; `export function useProgramacoes()` retornando `{ status: 'loading' | 'ready' | 'error', programacoes: Programacao[], criarProgramacao: (input: ProgramacaoInput) => Promise<{ error: string | null; programacao: Programacao | null }>, editarProgramacao: (programacao: Programacao, input: ProgramacaoInput) => Promise<{ error: string | null }>, cancelarProgramacao: (programacao: Programacao) => Promise<{ error: string | null }>, confirmarRealizacao: (programacao: Programacao) => Promise<{ error: string | null }> }`. Tasks 4, 6, 7, 8 consomem esses símbolos exatamente com esses nomes/tipos.

- [ ] **Step 1: Criar o hook**

Crie `frontend/src/features/programacoes/use-programacoes.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type Programacao = {
  id: string;
  congregacao_id: string;
  congregacao: { id: string; nome: string; numero: string };
  tema_id: string;
  tema: { id: string; numero: string; titulo: string; categoria: { id: string; nome: string } | null };
  orador_id: string;
  orador: { id: string; nome: string; sobrenome: string };
  data: string;
  status: 'Planejada' | 'Convite Enviado' | 'Confirmada' | 'Realizada' | 'Cancelada' | 'Arquivada';
  observacoes: string | null;
  criado_por: string;
};

export type ProgramacoesStatus = 'loading' | 'ready' | 'error';

export type ProgramacaoInput = {
  data: string;
  congregacaoId: string;
  temaId: string;
  oradorId: string;
  observacoes: string;
};

const PROGRAMACOES_SELECT =
  'id, congregacao_id, congregacao:congregacoes(id, nome, numero), ' +
  'tema_id, tema:temas(id, numero, titulo, categoria:categorias(id, nome)), ' +
  'orador_id, orador:oradores(id, nome, sobrenome), ' +
  'data, status, observacoes, criado_por';

const UNIQUE_VIOLATION = '23505';
const ERRO_DATA_DUPLICADA = 'Já existe uma programação para esta congregação nesta data.';
const ERRO_SALVAR = 'Não foi possível salvar. Tente novamente.';
const ERRO_JA_CONCLUIDA = 'Esta programação já foi realizada ou cancelada e não pode ser alterada.';
const ERRO_NAO_PODE_CONFIRMAR = 'Não é possível confirmar a realização ainda.';

function paraInsertUpdate(input: ProgramacaoInput) {
  return {
    congregacao_id: input.congregacaoId,
    tema_id: input.temaId,
    orador_id: input.oradorId,
    data: input.data,
    observacoes: input.observacoes || null,
  };
}

export function useProgramacoes() {
  const { usuario } = useAuth();
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [status, setStatus] = useState<ProgramacoesStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('programacoes')
      .select(PROGRAMACOES_SELECT)
      .order('data');

    if (error) {
      setStatus('error');
      return;
    }

    setProgramacoes((data ?? []) as unknown as Programacao[]);
    setStatus('ready');
  }, [usuario?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarProgramacao(
    input: ProgramacaoInput
  ): Promise<{ error: string | null; programacao: Programacao | null }> {
    if (!usuario) return { error: ERRO_SALVAR, programacao: null };

    const { data, error } = await supabase
      .from('programacoes')
      .insert({ ...paraInsertUpdate(input), status: 'Planejada', criado_por: usuario.id })
      .select(PROGRAMACOES_SELECT)
      .single();

    if (error || !data) {
      if (error?.code === UNIQUE_VIOLATION) return { error: ERRO_DATA_DUPLICADA, programacao: null };
      return { error: ERRO_SALVAR, programacao: null };
    }

    const programacao = data as unknown as Programacao;

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_criada',
      descricao: 'Programação criada',
    });

    await carregar();
    return { error: null, programacao };
  }

  async function editarProgramacao(
    programacao: Programacao,
    input: ProgramacaoInput
  ): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const { error } = await supabase
      .from('programacoes')
      .update(paraInsertUpdate(input))
      .eq('id', programacao.id);

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: ERRO_DATA_DUPLICADA };
      return { error: ERRO_SALVAR };
    }

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_editada',
      descricao: 'Programação editada',
    });

    await carregar();
    return { error: null };
  }

  async function cancelarProgramacao(programacao: Programacao): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };
    if (programacao.status === 'Realizada' || programacao.status === 'Cancelada') {
      return { error: ERRO_JA_CONCLUIDA };
    }

    const { error } = await supabase
      .from('programacoes')
      .update({ status: 'Cancelada' })
      .eq('id', programacao.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_cancelada',
      descricao: 'Programação cancelada',
    });

    await carregar();
    return { error: null };
  }

  async function confirmarRealizacao(programacao: Programacao): Promise<{ error: string | null }> {
    if (!usuario) return { error: ERRO_SALVAR };

    const hojeIso = new Date().toISOString().slice(0, 10);
    if (
      programacao.status === 'Realizada' ||
      programacao.status === 'Cancelada' ||
      programacao.data > hojeIso
    ) {
      return { error: ERRO_NAO_PODE_CONFIRMAR };
    }

    const { error } = await supabase
      .from('programacoes')
      .update({ status: 'Realizada' })
      .eq('id', programacao.id);

    if (error) return { error: ERRO_SALVAR };

    await supabase.from('historicos').insert({
      programacao_id: programacao.id,
      usuario_id: null,
      tipo: 'programacao_realizada',
      descricao: 'Realização da programação confirmada',
    });

    await carregar();
    return { error: null };
  }

  return { status, programacoes, criarProgramacao, editarProgramacao, cancelarProgramacao, confirmarRealizacao };
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `use-programacoes.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/programacoes/use-programacoes.ts
git commit -m "feat(programacoes): adicionar hook useProgramacoes"
```

---

### Task 4: Hook `useHistoricoProgramacao`

**Files:**
- Create: `frontend/src/features/programacoes/use-historico-programacao.ts`

**Interfaces:**
- Consumes: `useAuth()`, `supabase`.
- Produces: `export type EventoHistoricoProgramacao = { id: string; tipo: string; descricao: string; dados: Record<string, unknown> | null; criado_em: string }`; `export function useHistoricoProgramacao(programacaoId: string)` retornando `{ status: 'loading' | 'ready' | 'error', eventos: EventoHistoricoProgramacao[] }`. Task 7 consome.

- [ ] **Step 1: Criar o hook**

Crie `frontend/src/features/programacoes/use-historico-programacao.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/administracao/use-auth';
import { supabase } from '@/lib/supabase';

export type EventoHistoricoProgramacao = {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoProgramacaoStatus = 'loading' | 'ready' | 'error';

export function useHistoricoProgramacao(programacaoId: string) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<EventoHistoricoProgramacao[]>([]);
  const [status, setStatus] = useState<HistoricoProgramacaoStatus>('loading');

  const carregar = useCallback(async () => {
    if (!usuario || !programacaoId) return;

    setStatus('loading');
    const { data, error } = await supabase
      .from('historicos')
      .select('id, tipo, descricao, dados, criado_em')
      .eq('programacao_id', programacaoId)
      .order('criado_em', { ascending: false });

    if (error) {
      setStatus('error');
      return;
    }

    setEventos((data ?? []) as EventoHistoricoProgramacao[]);
    setStatus('ready');
  }, [usuario?.id, programacaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { status, eventos };
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `use-historico-programacao.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/programacoes/use-historico-programacao.ts
git commit -m "feat(programacoes): adicionar hook useHistoricoProgramacao"
```

---

### Task 5: Componente compartilhado `ProgramacaoForm`

**Files:**
- Create: `frontend/src/features/programacoes/programacao-form.tsx`

**Interfaces:**
- Consumes: `ProgramacaoInput` de `@/features/programacoes/use-programacoes` (Task 3); `CalendarioMensal`, `formatarDataIso` de `@/components/calendario-mensal` (Task 2); `DropdownSearchInput`, `encontrarPrimeiraCorrespondencia` de `@/components/dropdown-search-input` (já existe, criado na fatia de UX de teclado); `useTemas()` de `@/features/catalogo/use-temas`; `useOradores()` de `@/features/oradores/use-oradores`; `useTheme()` de `@/hooks/use-theme`.
- Produces: `export type CongregacaoOpcao = { id: string; nome: string; numero: string }`; `export function ProgramacaoForm(props: { valoresIniciais: ProgramacaoInput; mostrarCongregacao: boolean; congregacoes: CongregacaoOpcao[]; onSalvar: (valores: ProgramacaoInput) => Promise<{ error: string | null }>; onCancelar?: () => void; textoBotaoSalvar: string })`. Tasks 6, 7, 8 (via `[id].tsx`/`nova.tsx`) consomem `ProgramacaoForm` e `CongregacaoOpcao`.

**Achado durante a verificação ao vivo:** os três dropdowns (congregação, tema, orador) precisam de `ref={useRef<IDropdownRef>(null)}` + `.close()` dentro de `onSubmitPrimeiraCorrespondencia`, igual ao padrão já usado em `estado-cidade-picker.tsx`/`oradores/*.tsx` na fatia de UX de teclado — sem isso, o dropdown fica aberto depois do Enter selecionar o item, e o texto do tema selecionado (renderizado logo abaixo do dropdown de tema) sobrepõe e bloqueia cliques no dropdown de orador. O código abaixo já inclui essa correção; a mesma correção também é necessária no filtro de congregação de `programacoes/index.tsx` (Task 8).

- [ ] **Step 1: Criar o componente**

Crie `frontend/src/features/programacoes/programacao-form.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { useTheme } from '@/hooks/use-theme';
import { useTemas } from '@/features/catalogo/use-temas';
import { useOradores } from '@/features/oradores/use-oradores';
import type { ProgramacaoInput } from '@/features/programacoes/use-programacoes';

export type CongregacaoOpcao = { id: string; nome: string; numero: string };

const ERRO_CAMPOS = 'Preencha data, tema e orador.';

export function ProgramacaoForm({
  valoresIniciais,
  mostrarCongregacao,
  congregacoes,
  onSalvar,
  onCancelar,
  textoBotaoSalvar,
}: {
  valoresIniciais: ProgramacaoInput;
  mostrarCongregacao: boolean;
  congregacoes: CongregacaoOpcao[];
  onSalvar: (valores: ProgramacaoInput) => Promise<{ error: string | null }>;
  onCancelar?: () => void;
  textoBotaoSalvar: string;
}) {
  const colors = useTheme();
  const { temas } = useTemas();
  const { oradores } = useOradores();

  const [data, setData] = useState(valoresIniciais.data);
  const [congregacaoId, setCongregacaoId] = useState(valoresIniciais.congregacaoId);
  const [congregacaoBusca, setCongregacaoBusca] = useState('');
  const [temaId, setTemaId] = useState(valoresIniciais.temaId);
  const [temaBusca, setTemaBusca] = useState('');
  const [oradorId, setOradorId] = useState(valoresIniciais.oradorId);
  const [oradorBusca, setOradorBusca] = useState('');
  const [observacoes, setObservacoes] = useState(valoresIniciais.observacoes);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const hoje = new Date();
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [anoCalendario, setAnoCalendario] = useState(
    data ? Number(data.slice(0, 4)) : hoje.getFullYear()
  );
  const [mesCalendario, setMesCalendario] = useState(
    data ? Number(data.slice(5, 7)) - 1 : hoje.getMonth()
  );

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  const temaOpcoes = temas.filter((t) => t.ativo).map((t) => ({ id: t.id, label: `${t.numero}. ${t.titulo}` }));
  const temaSelecionado = temas.find((t) => t.id === temaId) ?? null;

  const oradorOpcoes = [...oradores.filter((o) => o.ativo)]
    .sort((a, b) => {
      const aPreparado = temaId ? a.temas_preparados.some((tp) => tp.tema_id === temaId) : false;
      const bPreparado = temaId ? b.temas_preparados.some((tp) => tp.tema_id === temaId) : false;
      if (aPreparado === bPreparado) return 0;
      return aPreparado ? -1 : 1;
    })
    .map((o) => ({ id: o.id, label: `${o.nome} ${o.sobrenome}` }));

  const congregacaoOpcoes = congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }));

  async function handleSalvar() {
    setErro(null);
    if (!data || !temaId || !oradorId || (mostrarCongregacao && !congregacaoId)) {
      setErro(ERRO_CAMPOS);
      return;
    }

    setSalvando(true);
    const { error } = await onSalvar({ data, congregacaoId, temaId, oradorId, observacoes });
    setSalvando(false);

    if (error) setErro(error);
  }

  return (
    <View style={{ gap: 12 }}>
      {mostrarCongregacao ? (
        <Dropdown
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
          value={congregacaoId}
          placeholder="Selecionar congregação"
          search
          searchPlaceholder="Buscar congregação..."
          onChangeText={setCongregacaoBusca}
          onChange={(item) => setCongregacaoId(item.id)}
          renderInputSearch={(onSearch) => (
            <DropdownSearchInput
              value={congregacaoBusca}
              onChangeText={onSearch}
              onSubmitPrimeiraCorrespondencia={() => {
                const primeiro = encontrarPrimeiraCorrespondencia(congregacaoOpcoes, 'label', congregacaoBusca);
                if (primeiro) setCongregacaoId(primeiro.id);
              }}
              placeholder="Buscar congregação..."
              placeholderTextColor={colors.textSecondary}
              color={colors.text}
            />
          )}
        />
      ) : null}

      <View>
        <Pressable
          onPress={() => setCalendarioAberto(!calendarioAberto)}
          className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
          <Text className="text-neutral-900 dark:text-white">
            {data ? formatarDataIso(data) : 'Selecionar data'}
          </Text>
        </Pressable>
        {calendarioAberto ? (
          <View className="mt-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <CalendarioMensal
              ano={anoCalendario}
              mes={mesCalendario}
              diaSelecionado={data}
              onSelecionarDia={(dataIso) => {
                setData(dataIso);
                setCalendarioAberto(false);
              }}
              onMudarMes={(ano, mes) => {
                setAnoCalendario(ano);
                setMesCalendario(mes);
              }}
            />
          </View>
        ) : null}
      </View>

      <Dropdown
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        inputSearchStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={temaOpcoes}
        labelField="label"
        valueField="id"
        value={temaId}
        placeholder="Selecionar tema"
        search
        searchPlaceholder="Buscar tema..."
        onChangeText={setTemaBusca}
        onChange={(item) => setTemaId(item.id)}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={temaBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(temaOpcoes, 'label', temaBusca);
              if (primeiro) setTemaId(primeiro.id);
            }}
            placeholder="Buscar tema..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />
      {temaSelecionado ? (
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {temaSelecionado.numero}. {temaSelecionado.titulo} · {temaSelecionado.categoria?.nome ?? 'Categoria indisponível'}
        </Text>
      ) : null}

      <Dropdown
        style={dropdownStyle}
        containerStyle={{ backgroundColor: colors.background }}
        placeholderStyle={{ color: colors.textSecondary }}
        selectedTextStyle={{ color: colors.text }}
        itemTextStyle={{ color: colors.text }}
        inputSearchStyle={{ color: colors.text }}
        activeColor={colors.backgroundSelected}
        data={oradorOpcoes}
        labelField="label"
        valueField="id"
        value={oradorId}
        placeholder="Selecionar orador"
        search
        searchPlaceholder="Buscar orador..."
        onChangeText={setOradorBusca}
        onChange={(item) => setOradorId(item.id)}
        renderInputSearch={(onSearch) => (
          <DropdownSearchInput
            value={oradorBusca}
            onChangeText={onSearch}
            onSubmitPrimeiraCorrespondencia={() => {
              const primeiro = encontrarPrimeiraCorrespondencia(oradorOpcoes, 'label', oradorBusca);
              if (primeiro) setOradorId(primeiro.id);
            }}
            placeholder="Buscar orador..."
            placeholderTextColor={colors.textSecondary}
            color={colors.text}
          />
        )}
      />

      <TextInput
        value={observacoes}
        onChangeText={setObservacoes}
        placeholder="Observações (opcional)"
        multiline
        numberOfLines={3}
        className="rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-600 dark:text-white"
      />

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      <View className="flex-row gap-3">
        <Pressable
          onPress={handleSalvar}
          disabled={salvando}
          className="flex-1 items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {salvando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">{textoBotaoSalvar}</Text>
          )}
        </Pressable>
        {onCancelar ? (
          <Pressable
            onPress={onCancelar}
            className="flex-1 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white">Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `programacao-form.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/programacoes/programacao-form.tsx
git commit -m "feat(programacoes): adicionar formulário compartilhado ProgramacaoForm"
```

---

### Task 6: Tela `programacoes/nova.tsx`

**Files:**
- Create: `frontend/src/app/(app)/programacoes/nova.tsx`

**Interfaces:**
- Consumes: `useAuth()`; `useProgramacoes()` (Task 3); `ProgramacaoForm`, `CongregacaoOpcao` (Task 5); `supabase`; `MaxContentWidth` de `@/constants/theme`.
- Produces: rota `/programacoes/nova`.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/programacoes/nova.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes } from '@/features/programacoes/use-programacoes';
import { ProgramacaoForm, type CongregacaoOpcao } from '@/features/programacoes/programacao-form';

export default function NovaProgramacaoScreen() {
  const { usuario } = useAuth();
  const { criarProgramacao } = useProgramacoes();
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);

  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
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
  }, [ehAdministradorGlobal]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Pressable onPress={() => router.back()} className="items-start py-2">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">‹ Voltar</Text>
          </Pressable>

          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Nova Programação</Text>

          <ProgramacaoForm
            valoresIniciais={{
              data: '',
              congregacaoId: ehAdministradorGlobal ? '' : (usuario?.congregacao_id ?? ''),
              temaId: '',
              oradorId: '',
              observacoes: '',
            }}
            mostrarCongregacao={ehAdministradorGlobal}
            congregacoes={congregacoes}
            textoBotaoSalvar="Salvar Programação"
            onSalvar={async (valores) => {
              const { error, programacao } = await criarProgramacao(valores);
              if (!error && programacao) router.replace(`/programacoes/${programacao.id}`);
              return { error };
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `programacoes/nova.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/programacoes/nova.tsx"
git commit -m "feat(programacoes): adicionar tela Nova Programação"
```

---

### Task 7: Tela `programacoes/[id].tsx`

**Files:**
- Create: `frontend/src/app/(app)/programacoes/[id].tsx`

**Interfaces:**
- Consumes: `useAuth()`; `useProgramacoes()`, `type Programacao` (Task 3); `useHistoricoProgramacao()` (Task 4); `ProgramacaoForm`, `type CongregacaoOpcao` (Task 5); `formatarDataIso` (Task 2); `supabase`; `useTheme()`; `MaxContentWidth`.
- Produces: rota `/programacoes/[id]`.

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/programacoes/[id].tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes, type Programacao } from '@/features/programacoes/use-programacoes';
import { useHistoricoProgramacao } from '@/features/programacoes/use-historico-programacao';
import { formatarDataIso } from '@/components/calendario-mensal';
import { ProgramacaoForm, type CongregacaoOpcao } from '@/features/programacoes/programacao-form';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];

type Secao = 'dados' | 'historico';

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

export default function ProgramacaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  const { status, programacoes, editarProgramacao, cancelarProgramacao, confirmarRealizacao } = useProgramacoes();
  const programacao = programacoes.find((p) => p.id === id) ?? null;

  const [secao, setSecao] = useState<Secao>('dados');

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  if (status === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (status === 'error' || !programacao) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900">
        <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
          Não foi possível carregar as programações.
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
            {formatarDataIso(programacao.data)}
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
              programacao={programacao}
              podeGerenciar={podeGerenciar}
              ehAdministradorGlobal={ehAdministradorGlobal}
              editarProgramacao={editarProgramacao}
              cancelarProgramacao={cancelarProgramacao}
              confirmarRealizacao={confirmarRealizacao}
            />
          ) : null}
          {secao === 'historico' ? <SecaoHistorico programacaoId={programacao.id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecaoDados({
  programacao,
  podeGerenciar,
  ehAdministradorGlobal,
  editarProgramacao,
  cancelarProgramacao,
  confirmarRealizacao,
}: {
  programacao: Programacao;
  podeGerenciar: boolean;
  ehAdministradorGlobal: boolean;
  editarProgramacao: ReturnType<typeof useProgramacoes>['editarProgramacao'];
  cancelarProgramacao: ReturnType<typeof useProgramacoes>['cancelarProgramacao'];
  confirmarRealizacao: ReturnType<typeof useProgramacoes>['confirmarRealizacao'];
}) {
  const [editando, setEditando] = useState(false);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
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
  }, [ehAdministradorGlobal]);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const podeAlterar = podeGerenciar && programacao.status !== 'Realizada' && programacao.status !== 'Cancelada';
  const podeConfirmarRealizacao = podeAlterar && programacao.data <= hojeIso;

  async function handleCancelar() {
    setErro(null);
    setProcessando(true);
    const { error } = await cancelarProgramacao(programacao);
    setProcessando(false);
    if (error) setErro(error);
  }

  async function handleConfirmarRealizacao() {
    setErro(null);
    setProcessando(true);
    const { error } = await confirmarRealizacao(programacao);
    setProcessando(false);
    if (error) setErro(error);
  }

  if (editando) {
    return (
      <ProgramacaoForm
        valoresIniciais={{
          data: programacao.data,
          congregacaoId: programacao.congregacao_id,
          temaId: programacao.tema_id,
          oradorId: programacao.orador_id,
          observacoes: programacao.observacoes ?? '',
        }}
        mostrarCongregacao={ehAdministradorGlobal}
        congregacoes={congregacoes}
        textoBotaoSalvar="Salvar"
        onCancelar={() => setEditando(false)}
        onSalvar={async (valores) => {
          const { error } = await editarProgramacao(programacao, valores);
          if (!error) setEditando(false);
          return { error };
        }}
      />
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Congregação</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.congregacao.nome} ({programacao.congregacao.numero})
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Tema</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.tema.numero}. {programacao.tema.titulo}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Orador</Text>
          <Text className="text-base text-neutral-900 dark:text-white">
            {programacao.orador.nome} {programacao.orador.sobrenome}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Status</Text>
          <Text className="text-base text-neutral-900 dark:text-white">{programacao.status}</Text>
        </View>
        {programacao.observacoes ? (
          <View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">Observações</Text>
            <Text className="text-base text-neutral-900 dark:text-white">{programacao.observacoes}</Text>
          </View>
        ) : null}
      </View>

      {erro ? <Text className="text-sm text-red-600 dark:text-red-400">{erro}</Text> : null}

      {podeAlterar ? (
        <Pressable
          onPress={() => setEditando(true)}
          className="items-center rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white">Editar</Text>
        </Pressable>
      ) : null}

      {podeConfirmarRealizacao ? (
        <Pressable
          onPress={handleConfirmarRealizacao}
          disabled={processando}
          className="items-center rounded-lg bg-neutral-900 px-4 py-3 dark:bg-white">
          {processando ? (
            <ActivityIndicator />
          ) : (
            <Text className="font-medium text-white dark:text-neutral-900">Confirmar Realização</Text>
          )}
        </Pressable>
      ) : null}

      {podeAlterar ? (
        <Pressable
          onPress={handleCancelar}
          disabled={processando}
          className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-700">
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Cancelar Programação</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SecaoHistorico({ programacaoId }: { programacaoId: string }) {
  const { status, eventos } = useHistoricoProgramacao(programacaoId);

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
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `programacoes/[id].tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/programacoes/[id].tsx"
git commit -m "feat(programacoes): adicionar tela de detalhe, edição, cancelamento e confirmação"
```

---

### Task 8: Tela `programacoes/index.tsx` (Agenda + Calendário)

**Files:**
- Create: `frontend/src/app/(app)/programacoes/index.tsx`
- Create: `frontend/src/app/(app)/programacoes/_layout.tsx` — **achado durante a execução, não previsto originalmente neste plano**: `oradores/` tem um `_layout.tsx` (`<Stack screenOptions={{ headerShown: false }} />`) que faltava copiar para `programacoes/`. Sem ele, o `Tabs`/`TabSlot` do `expo-router/ui` (web) não sabe resolver as sub-rotas (`nova`, `[id]`) dentro da aba — navegar para `/programacoes/nova` (via clique ou URL direta) voltava silenciosamente pra `/`, sem nenhum erro no console. Confirmado com Playwright: sem o `_layout.tsx`, `router.push('/programacoes/nova')` nunca completa a navegação; com ele, funciona igual a `oradores/novo`.

```tsx
import { Stack } from 'expo-router';

export default function ProgramacoesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Interfaces:**
- Consumes: `useAuth()`; `useProgramacoes()` (Task 3); `CalendarioMensal`, `formatarDataIso` (Task 2); `DropdownSearchInput`, `encontrarPrimeiraCorrespondencia`; `supabase`; `useTheme()`; `MaxContentWidth`.
- Produces: rota `/programacoes` (alvo da aba de navegação, ver Task 9).

- [ ] **Step 1: Criar a tela**

Crie `frontend/src/app/(app)/programacoes/index.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import { router } from 'expo-router';

import { useAuth } from '@/features/administracao/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useProgramacoes } from '@/features/programacoes/use-programacoes';
import { CalendarioMensal, formatarDataIso } from '@/components/calendario-mensal';
import { DropdownSearchInput, encontrarPrimeiraCorrespondencia } from '@/components/dropdown-search-input';

const PODE_GERENCIAR = ['Coordenador', 'Editor', 'Administrador Global'];
const TODAS_CONGREGACOES = { id: '', label: 'Todas as congregações' };

type Aba = 'lista' | 'calendario';
type CongregacaoOpcao = { id: string; nome: string; numero: string };

export default function ProgramacoesScreen() {
  const { usuario } = useAuth();
  const colors = useTheme();
  const { status, programacoes } = useProgramacoes();

  const [aba, setAba] = useState<Aba>('lista');
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [congregacaoFiltroId, setCongregacaoFiltroId] = useState('');
  const [congregacaoFiltroBusca, setCongregacaoFiltroBusca] = useState('');

  const hoje = new Date();
  const [anoCalendario, setAnoCalendario] = useState(hoje.getFullYear());
  const [mesCalendario, setMesCalendario] = useState(hoje.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const podeGerenciar = usuario ? PODE_GERENCIAR.includes(usuario.perfil.nome) : false;
  const ehAdministradorGlobal = usuario?.perfil.nome === 'Administrador Global';

  const dropdownStyle = {
    height: 50,
    borderWidth: 1,
    borderColor: colors.backgroundSelected,
    borderRadius: 8,
    paddingHorizontal: 16,
  };

  useEffect(() => {
    if (!ehAdministradorGlobal) return;
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
  }, [ehAdministradorGlobal]);

  const programacoesFiltradas = congregacaoFiltroId
    ? programacoes.filter((p) => p.congregacao_id === congregacaoFiltroId)
    : programacoes;

  const diasComEvento = new Set(programacoesFiltradas.map((p) => p.data));
  const programacoesDoDia = diaSelecionado
    ? programacoesFiltradas.filter((p) => p.data === diaSelecionado)
    : [];

  const congregacaoOpcoes = [TODAS_CONGREGACOES, ...congregacoes.map((c) => ({ id: c.id, label: `${c.nome} (${c.numero})` }))];

  function selecionarCongregacaoFiltro(item: { id: string; label: string }) {
    setCongregacaoFiltroId(item.id);
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
          Não foi possível carregar as programações.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: MaxContentWidth, gap: 12 }}>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Programações</Text>

          {ehAdministradorGlobal ? (
            <Dropdown
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
              value={congregacaoFiltroId}
              placeholder="Filtrar por congregação"
              search
              searchPlaceholder="Buscar congregação..."
              onChangeText={setCongregacaoFiltroBusca}
              onChange={selecionarCongregacaoFiltro}
              renderInputSearch={(onSearch) => (
                <DropdownSearchInput
                  value={congregacaoFiltroBusca}
                  onChangeText={onSearch}
                  onSubmitPrimeiraCorrespondencia={() => {
                    const primeiro = encontrarPrimeiraCorrespondencia(
                      congregacaoOpcoes,
                      'label',
                      congregacaoFiltroBusca
                    );
                    if (primeiro) selecionarCongregacaoFiltro(primeiro);
                  }}
                  placeholder="Buscar congregação..."
                  placeholderTextColor={colors.textSecondary}
                  color={colors.text}
                />
              )}
            />
          ) : null}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setAba('lista')}
              className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'lista' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Lista</Text>
            </Pressable>
            <Pressable
              onPress={() => setAba('calendario')}
              className={`flex-1 items-center rounded-lg border px-3 py-2 ${aba === 'calendario' ? 'border-neutral-900 dark:border-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Calendário</Text>
            </Pressable>
          </View>

          {aba === 'lista' ? (
            <>
              {programacoesFiltradas.length === 0 ? (
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma programação encontrada.</Text>
              ) : null}
              {programacoesFiltradas.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/programacoes/${p.id}`)}
                  className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <Text className="text-base font-medium text-neutral-900 dark:text-white">
                    {formatarDataIso(p.data)} · {p.tema.numero}. {p.tema.titulo}
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                    {p.orador.nome} {p.orador.sobrenome} · {p.status}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <CalendarioMensal
                ano={anoCalendario}
                mes={mesCalendario}
                diasComEvento={diasComEvento}
                diaSelecionado={diaSelecionado}
                onSelecionarDia={setDiaSelecionado}
                onMudarMes={(ano, mes) => {
                  setAnoCalendario(ano);
                  setMesCalendario(mes);
                }}
              />
              {diaSelecionado ? (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                    {formatarDataIso(diaSelecionado)}
                  </Text>
                  {programacoesDoDia.length === 0 ? (
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma programação neste dia.</Text>
                  ) : (
                    programacoesDoDia.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => router.push(`/programacoes/${p.id}`)}
                        className="gap-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                        <Text className="text-base font-medium text-neutral-900 dark:text-white">
                          {p.tema.numero}. {p.tema.titulo}
                        </Text>
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                          {p.orador.nome} {p.orador.sobrenome} · {p.status}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}

          {podeGerenciar ? (
            <Pressable
              onPress={() => router.push('/programacoes/nova')}
              className="mt-2 items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white">Nova Programação</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Rode: `cd frontend && npx tsc --noEmit`
Esperado: sem erros novos relacionados a `programacoes/index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(app)/programacoes/index.tsx"
git commit -m "feat(programacoes): adicionar tela Agenda/Calendário"
```

---

### Task 9: Navegação + verificação end-to-end

**Files:**
- Modify: `frontend/src/components/app-tabs.tsx`
- Modify: `frontend/src/components/app-tabs.web.tsx`

**Interfaces:**
- Consumes: rota `/programacoes` produzida na Task 8.

- [ ] **Step 1: Adicionar a aba no `app-tabs.tsx` (native)**

Em `frontend/src/components/app-tabs.tsx`, depois do trigger `oradores` e antes do trigger `suporte` (ordem sugerida — Programações é operacional, Suporte fica por último):

```tsx
      <NativeTabs.Trigger name="oradores">
        <NativeTabs.Trigger.Label>Oradores</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="programacoes">
        <NativeTabs.Trigger.Label>Programações</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="suporte">
        <NativeTabs.Trigger.Label>Suporte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
```

- [ ] **Step 2: Adicionar a aba no `app-tabs.web.tsx` (web)**

Em `frontend/src/components/app-tabs.web.tsx`, mesma posição:

```tsx
          <TabTrigger name="oradores" href="/oradores" asChild>
            <TabButton>Oradores</TabButton>
          </TabTrigger>
          <TabTrigger name="programacoes" href="/programacoes" asChild>
            <TabButton>Programações</TabButton>
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
Esperado: `tsc` sem erros; `expo lint` sem erros novos nos arquivos tocados nesta feature (warnings do padrão `react-hooks/set-state-in-effect` já existem em todo hook de fetch do projeto — não é regressão, ver Global Constraints da fatia de Suporte).

Depois de rodar `expo lint`, reverta os efeitos colaterais que ele gera no projeto (adiciona `eslint`/`eslint-config-expo` a `package.json`/`package-lock.json` e cria `eslint.config.js`, já visto nas fatias anteriores):

```bash
git checkout -- frontend/package.json frontend/package-lock.json
rm -f frontend/eslint.config.js
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/app-tabs.tsx frontend/src/components/app-tabs.web.tsx
git commit -m "feat(programacoes): adicionar aba Programações à navegação"
```

- [ ] **Step 5: Verificação manual ao vivo (Playwright, logado)**

Suba o servidor web (`cd frontend && npx expo start --web --port 8081`, aguardar `curl -sf http://localhost:8081` responder) e, com Playwright, logado com a conta de teste já usada nesta conversa (Administrador Global):

1. Login → abrir `/programacoes` pela aba nova. Confirmar que a lista carrega (vazia ou com dados de teste anteriores) e que a aba Calendário abre a grade de mês.
2. "Nova Programação" → tocar no seletor de data (abre o calendário compacto), escolher um dia, escolher um tema, confirmar que oradores preparados pro tema aparecem primeiro no dropdown de orador, escolher um orador, salvar → redireciona pro detalhe, dados batem, evento `programacao_criada` na aba Histórico.
3. Tentar criar outra Programação pra mesma congregação na mesma data → mensagem de duplicidade.
4. No detalhe, "Cancelar Programação" → status muda pra `Cancelada`, botões "Editar"/"Cancelar"/"Confirmar Realização" somem, evento `programacao_cancelada` no Histórico.
5. Criar uma nova Programação pra mesma congregação, mesma data da cancelada → agora permitido.
6. "Editar" essa nova Programação (trocar tema) → salva, evento `programacao_editada`.
7. Checar console do navegador (`page.on('console', ...)`) → sem erros, em todas as telas visitadas.

Encerrar o servidor: `lsof -ti:8081 -sTCP:LISTEN | xargs -r kill`.

- [ ] **Step 6: Verificação de "Confirmar Realização" (data no passado)**

Via `mcp__claude_ai_Supabase__execute_sql` (`project_id: imeoyetcbjlkrxubwldv`), atualize a `data` de uma Programação de teste em status `Planejada` pra ontem:

```sql
update public.programacoes set data = (current_date - interval '1 day')::date
where id = '<id-da-programacao-de-teste>' and status = 'Planejada';
```

No navegador, abrir o detalhe dessa Programação → botão "Confirmar Realização" deve aparecer (data já passou); tocar → status muda pra `Realizada`, evento `programacao_realizada` no Histórico, botões "Editar"/"Cancelar"/"Confirmar Realização" somem.

- [ ] **Step 7: Verificação de RLS (texto das policies, sem mudança nesta fatia)**

Via `mcp__claude_ai_Supabase__execute_sql`, confirme que a RLS de `programacoes` não mudou (nenhuma Task deste plano toca RLS):

```sql
select policyname, cmd, qual, with_check from pg_policies where tablename = 'programacoes' order by policyname;
```

Confirme que `programacoes_select` usa `is_administrador_global() OR congregacao_id = current_usuario_congregacao_id()`, e que `programacoes_write`/`programacoes_update` usam `is_administrador_global() OR (is_coordenador_ou_editor() AND congregacao_id = current_usuario_congregacao_id())` — exatamente como documentado na spec. Se algum desses textos não bater, algo além desta fatia mudou a RLS e precisa ser investigado antes de prosseguir.

- [ ] **Step 8: Limpar dados de teste**

Via `mcp__claude_ai_Supabase__execute_sql`, apague as Programações de teste criadas nos Steps 5/6 (ex.: por `criado_em > now() - interval '1 hour'` e `congregacao_id` da congregação de teste usada), e os eventos de `historicos` correspondentes (`where programacao_id in (...)`), para não deixar dados fictícios na base.

---

## Self-Review Notes

- **Cobertura da spec:** correção do índice condicional (Task 1), componente de calendário reutilizável (Task 2), hooks de dados e histórico (Tasks 3-4), formulário compartilhado (Task 5), as três telas (Tasks 6-8), navegação e verificação completa incluindo o cenário de "Confirmar Realização" com data passada (Task 9) — todas as seções da spec têm task correspondente.
- **Placeholders:** nenhum "TBD"/"similar to" — todo código de cada task está completo no próprio step. `<id-da-programacao-de-teste>` no Step 6 da Task 9 é intencional (preenchido em tempo de execução com o id real criado no Step 5, não um placeholder de conteúdo).
- **Consistência de tipos:** `ProgramacaoInput` (Task 3) é o mesmo tipo usado como `valoresIniciais`/parâmetro de `onSalvar` em `ProgramacaoForm` (Task 5) e nas telas que o consomem (Tasks 6-7) — sem duplicar a forma do objeto. `Programacao` (Task 3) é o mesmo tipo usado em `[id].tsx` e `index.tsx`. `CongregacaoOpcao` é definido uma vez (Task 5) e importado nas Tasks 6-8.
