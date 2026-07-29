// One button. Four variants. It replaces ~30 hand-rolled button styles.
//
// Two things here are load-bearing for accessibility:
//   • `disabled` uses a neutral FILL, not opacity. Opacity drags the label
//     below AA; colors.body on colors.neutralBg stays at 7.32:1.
//   • `loading` keeps the label mounted (just invisible) so the button does
//     not change width mid-press and shove the layout around.

import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, layout, radius, spacing } from '@/lib/theme';

import { Text, type TextColor } from './text';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type ButtonVariant = 'primary' | 'secondary' | 'info' | 'quiet' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** lg = 56dp, for full-width CTAs. md = 48dp, the a11y minimum. */
  size?: 'lg' | 'md';
  icon?: FeatherName;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Inverted treatment for the green voice stage. */
  onPrimaryBg?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
};

type Skin = { bg: string; pressedBg: string; fg: TextColor; border?: string };

// Orange, gold and red all sit within 24° of hue, so variants are separated
// by FORM as much as colour: primary is the only solid fill, destructive is
// an outline. That distinction survives sunlight and colour-blindness.
const SKINS: Record<ButtonVariant, Skin> = {
  /** The ONE solid fill in the kit. Navy label on Oranye hangat (5.97:1). */
  primary: { bg: colors.primary, pressedBg: colors.primaryDark, fg: 'onPrimary' },
  secondary: {
    bg: colors.primarySoft,
    pressedBg: colors.primarySoftPressed,
    fg: 'primaryInk',
  },
  /**
   * Biru percaya. For assistive actions the palette hands to blue — reading
   * the GPS, opening Maps. A tint rather than a solid fill, so it stays below
   * the one orange CTA in the visual order.
   */
  info: {
    bg: colors.linkSoft,
    pressedBg: colors.linkSoftPressed,
    fg: 'linkInk',
  },
  quiet: {
    bg: 'transparent',
    pressedBg: colors.neutralBg,
    fg: 'body',
    border: colors.inputBorder,
  },
  /** Outline, not a fill — a red block reads too close to the orange CTA. */
  destructive: {
    bg: 'transparent',
    pressedBg: colors.dangerBg,
    fg: 'danger',
    border: colors.danger,
  },
};

// On the saturated orange stage, cream becomes the fill and orange the ink.
const ON_PRIMARY_SKIN: Skin = {
  bg: colors.bg,
  pressedBg: colors.card,
  fg: 'primaryInk',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'leading',
  loading = false,
  disabled = false,
  fullWidth = true,
  onPrimaryBg = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const skin = onPrimaryBg ? ON_PRIMARY_SKIN : SKINS[variant];
  const isOff = disabled || loading;
  const height = size === 'lg' ? layout.ctaHeight : layout.minTouch;

  const fg: TextColor = isOff ? 'body' : skin.fg;
  const iconColor = isOff ? colors.body : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isOff, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height, alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        { backgroundColor: isOff ? colors.disabled : pressed ? skin.pressedBg : skin.bg },
        skin.border && !isOff ? { borderWidth: 1, borderColor: skin.border } : null,
        style,
      ]}>
      {/* Kept mounted while loading so the width never jumps. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {icon && iconPosition === 'leading' && (
          <Feather name={icon} size={18} color={iconColor ?? resolveIconColor(fg)} />
        )}
        <Text variant="button" color={fg} numberOfLines={1}>
          {label}
        </Text>
        {icon && iconPosition === 'trailing' && (
          <Feather name={icon} size={18} color={iconColor ?? resolveIconColor(fg)} />
        )}
      </View>
      {loading && (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={resolveIconColor(fg)} />
      )}
    </Pressable>
  );
}

function resolveIconColor(fg: TextColor): string {
  switch (fg) {
    case 'onPrimary':
      return colors.onPrimary;
    case 'primaryInk':
      return colors.primaryInk;
    case 'danger':
      return colors.danger;
    default:
      return colors.body;
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hidden: { opacity: 0 },
});
