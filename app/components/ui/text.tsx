// The only way text is styled in this app.
//
// Screens never write `fontFamily` / `fontSize` again — they pick a `variant`
// from the type scale in lib/theme.ts. That is what stops the scale from
// drifting back into 22 different font sizes with half-pixel values.

import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/lib/theme';

const TEXT_COLORS = {
  text: colors.text,
  body: colors.body,
  secondary: colors.secondary,
  // `primary` maps to primaryInk, NOT to the raw orange: #F2811D on cream is
  // 2.47:1. There is deliberately no way to render unreadable orange type.
  primary: colors.primaryInk,
  primaryInk: colors.primaryInk,
  link: colors.link,
  /** Blue text sitting on linkSoft (7.18:1). */
  linkInk: colors.linkInk,
  /** Toska aktif as TYPE — the raw #17B891 is 2.36:1 and never a text colour. */
  success: colors.successInk,
  warn: colors.warnInk,
  /** Merah Perhatian as TYPE — raw #D64545 is 4.09:1, so this is the ink. */
  danger: colors.dangerInk,
  onPrimary: colors.onPrimary,
  onPrimarySoft: colors.onPrimarySoft,
  /** Cream on a navy surface — the auth dome (14.76:1). */
  onDark: colors.bg,
  /** Muted cream on navy, for supporting lines on the dome (8.96:1). */
  onDarkSoft: '#B9C4D4',
} as const;

export type TextColor = keyof typeof TEXT_COLORS;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      // Never disable font scaling — some of our users run their phone at
      // 150%. Cap it instead, so layouts bend rather than break.
      maxFontSizeMultiplier={1.6}
      style={[
        typography[variant],
        { color: TEXT_COLORS[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
