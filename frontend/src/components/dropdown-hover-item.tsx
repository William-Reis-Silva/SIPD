import { Pressable, Text } from 'react-native';

export type DropdownHoverItemProps = {
  label: string;
  textColor: string;
};

/**
 * react-native-element-dropdown renderiza cada item com TouchableHighlight,
 * que não tem estado de hover no web. Substituímos só o conteúdo interno
 * (via `renderItem`) por um Pressable, que expõe `hovered` no react-native-web.
 */
export function DropdownHoverItem({ label, textColor }: DropdownHoverItemProps) {
  return (
    <Pressable className="flex-row items-center px-[17px] py-[17px] hover:bg-neutral-100 dark:hover:bg-neutral-800">
      <Text className="flex-1 text-base" style={{ color: textColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
