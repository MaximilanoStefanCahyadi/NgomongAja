// Back link + screen title + optional right-hand slot.
//
// This was written out longhand in 18 screens, each with its own back-arrow
// size and its own title font size. The back control gets a real 48dp
// target here — the old version was a bare <Text> with hitSlop, which
// enlarges the touch area but leaves the visible affordance tiny.

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, spacing } from '@/lib/theme';

import { Text } from './text';

export type ScreenHeaderProps = {
  /** Omit on stages that are their own headline (e.g. the voice screen). */
  title?: string;
  /** Omit to hide the back control entirely. */
  backLabel?: string;
  onBack?: () => void;
  subtitle?: string;
  right?: React.ReactNode;
  /** White-ink variant for the saturated green voice stage. */
  onPrimaryBg?: boolean;
};

export function ScreenHeader({
  title,
  backLabel,
  onBack,
  subtitle,
  right,
  onPrimaryBg = false,
}: ScreenHeaderProps) {
  const inkColor = onPrimaryBg ? 'onPrimary' : 'text';
  const metaColor = onPrimaryBg ? 'onPrimarySoft' : 'secondary';
  const iconColor = onPrimaryBg ? colors.onPrimarySoft : colors.primary;

  return (
    <View style={styles.wrap}>
      {backLabel != null && (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel={backLabel || 'Kembali'}
          style={styles.back}>
          <Feather name="chevron-left" size={20} color={iconColor} />
          <Text variant="label" color={onPrimaryBg ? 'onPrimarySoft' : 'primary'}>
            {backLabel || 'Kembali'}
          </Text>
        </Pressable>
      )}

      {(!!title || !!subtitle || !!right) && (
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            {!!subtitle && (
              <Text variant="meta" color={metaColor}>
                {subtitle}
              </Text>
            )}
            {!!title && (
              <Text variant="display" color={inkColor} accessibilityRole="header">
                {title}
              </Text>
            )}
          </View>
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouch,
    paddingRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
});
