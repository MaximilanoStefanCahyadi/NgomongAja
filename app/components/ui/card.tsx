// A surface. No border, no shadow — just a warm fill and a radius.
//
// `tone` is the whole point. The old code signalled "Habis" with an amber
// fill AND an amber border AND amber bold text AND a solid amber button:
// four channels for one fact. Here a tone changes the fill and adds a single
// 3px left rule, and that is the entire vocabulary.

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

export type CardTone = 'default' | 'success' | 'warn' | 'danger';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  tone?: CardTone;
  padding?: 'sm' | 'md';
  gap?: number;
  row?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const TONES: Record<CardTone, { bg: string; pressedBg: string; rule?: string }> = {
  default: { bg: colors.card, pressedBg: colors.neutralBg },
  success: { bg: colors.primarySoft, pressedBg: colors.primarySoftPressed, rule: colors.primary },
  warn: { bg: colors.warnBg, pressedBg: '#f5e4cb', rule: colors.warnInk },
  danger: { bg: colors.dangerBg, pressedBg: '#f2dbd7', rule: colors.danger },
};

export function Card({
  children,
  onPress,
  tone = 'default',
  padding = 'md',
  gap,
  row = false,
  accessibilityLabel,
  style,
}: CardProps) {
  const skin = TONES[tone];
  const pad = padding === 'sm' ? spacing.md : spacing.lg;

  const base = (pressed: boolean): StyleProp<ViewStyle> => [
    styles.base,
    {
      backgroundColor: pressed ? skin.pressedBg : skin.bg,
      padding: pad,
      // The left rule replaces the border + bold-text + tinted-icon stack.
      paddingLeft: skin.rule ? pad + 3 : pad,
      borderLeftWidth: skin.rule ? 3 : 0,
      borderLeftColor: skin.rule ?? 'transparent',
    },
    row ? styles.row : null,
    gap != null ? { gap } : null,
    style,
  ];

  if (!onPress) return <View style={base(false)}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => base(pressed)}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
