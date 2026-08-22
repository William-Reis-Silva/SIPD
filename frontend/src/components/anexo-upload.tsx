import { Text, View } from 'react-native';

export type AnexoUploadProps = {
  onArquivosSelecionados: (arquivos: File[]) => void;
  desabilitado?: boolean;
};

export function AnexoUpload({}: AnexoUploadProps) {
  return (
    <View className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
      <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        Envio de anexos disponível apenas no navegador.
      </Text>
    </View>
  );
}
