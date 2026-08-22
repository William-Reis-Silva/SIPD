import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

export type AnexoUploadProps = {
  onArquivosSelecionados: (arquivos: File[]) => void;
  desabilitado?: boolean;
};

export function AnexoUpload({ onArquivosSelecionados, desabilitado }: AnexoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <View>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(evento) => {
          const arquivos = evento.target.files ? Array.from(evento.target.files) : [];
          if (arquivos.length > 0) onArquivosSelecionados(arquivos);
          evento.target.value = '';
        }}
      />
      <Pressable
        onPress={() => inputRef.current?.click()}
        disabled={desabilitado}
        className="items-center rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-600">
        <Text className="text-sm font-medium text-neutral-900 dark:text-white">Anexar arquivo</Text>
      </Pressable>
    </View>
  );
}
