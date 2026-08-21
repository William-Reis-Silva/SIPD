import { StyleSheet, TextInput } from 'react-native';

export type BuscaPredicado = (palavraChave: string, valorRotulo: string) => boolean;

function correspondePorSubstring(palavraChave: string, valorRotulo: string) {
  return valorRotulo.toLowerCase().includes(palavraChave.toLowerCase());
}

export function encontrarPrimeiraCorrespondencia<T>(
  dados: T[],
  campoRotulo: keyof T,
  textoBusca: string,
  predicado?: BuscaPredicado
): T | undefined {
  const texto = textoBusca.trim();
  if (!texto) return undefined;
  const corresponde = predicado ?? correspondePorSubstring;
  return dados.find((item) => corresponde(texto, String(item[campoRotulo])));
}

export type DropdownSearchInputProps = {
  value: string;
  onChangeText: (texto: string) => void;
  onSubmitPrimeiraCorrespondencia: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  color?: string;
};

/**
 * Substitui a caixa de busca padrão do react-native-element-dropdown (via
 * `renderInputSearch`) para permitir selecionar o primeiro resultado com
 * Enter — a biblioteca não expõe essa tecla por padrão.
 */
export function DropdownSearchInput({
  value,
  onChangeText,
  onSubmitPrimeiraCorrespondencia,
  placeholder,
  placeholderTextColor,
  color,
}: DropdownSearchInputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitPrimeiraCorrespondencia}
      blurOnSubmit={false}
      returnKeyType="search"
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      autoCorrect={false}
      style={[styles.input, { color }]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 0.5,
    borderColor: '#DDDDDD',
    paddingHorizontal: 8,
    marginBottom: 8,
    margin: 6,
    height: 45,
    fontSize: 16,
  },
});
