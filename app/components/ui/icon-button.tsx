// A circular icon-only control for headers.
//
// Bumped from the old 44dp to 48dp. Icon-only means there is no text to
// fall back on, so `accessibilityLabel` is required, not optional.

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { colors, layout, radius } from '@/lib/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type IconButtonProps = {
  icon: FeatherName;
  onPress: () => void;
  accessibilityLabel: string;
  /** `danger` is for destructive icon actions — removing a line from a cart. */
  tone?: 'default' | 'onPrimary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

const TONES = {
  default: { fg: colors.text, border: colors.border, pressed: colors.neutralBg },
  onPrimary: {
    fg: colors.onPrimary,
    border: colors.onPrimarySoft,
    pressed: 'rgba(255,255,255,.18)',
  },
  danger: { fg: colors.danger, border: colors.danger, pressed: colors.dangerBg },
} as const;

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'default',
  disabled = false,
  style,
}: IconButtonProps) {
  const skin = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && !disabled ? skin.pressed : 'transparent',
          borderColor: disabled ? colors.border : skin.border,
        },
        style,
      ]}>
      <Feather name={icon} size={20} color={disabled ? colors.secondary : skin.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
