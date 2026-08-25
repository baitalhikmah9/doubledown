/** Lightweight Ionicons (and friends) double for `@expo/vector-icons`. */
import React from 'react';
import { Text, type TextProps } from 'react-native';

type IconProps = TextProps & {
  name?: string;
  size?: number;
  color?: string;
};

function Icon({ name, accessibilityLabel, ...rest }: IconProps) {
  return React.createElement(
    Text,
    {
      accessibilityLabel: accessibilityLabel ?? name,
      ...rest,
    },
    name ?? 'icon'
  );
}

export const Ionicons = Icon;
export const MaterialIcons = Icon;
export const MaterialCommunityIcons = Icon;
export const FontAwesome = Icon;
export const FontAwesome5 = Icon;
export const Feather = Icon;
export const AntDesign = Icon;
export const Entypo = Icon;
export const EvilIcons = Icon;
export const Foundation = Icon;
export const Octicons = Icon;
export const SimpleLineIcons = Icon;
export const Zocial = Icon;
export default { Ionicons };
