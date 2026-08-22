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
  diasSelecionados?: Set<string>;
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
  diasSelecionados,
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
            const selecionado = diasSelecionados ? diasSelecionados.has(dataIso) : diaSelecionado === dataIso;

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
