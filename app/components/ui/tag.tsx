// A status chip.
//
// The old pattern was a <Text> with padding and `overflow: 'hidden'` to fake
// a pill. That clips descenders on Android (the "g" in "Menunggu" loses its
// tail) and collapses entirely once the system font scale goes up. A View
// wrapping a Text has neither problem.

import { StyleSheet, View, type ViewStyle } from 'react-native';

import { TONE, type Tone } from '@/lib/status-ui';
import { radius, spacing } from '@/lib/theme';

import { Text } from './text';

export type TagProps = {
  label: string;
  tone?: Tone;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Tag({ label, tone = 'neutral', accessibilityLabel, style }: TagProps) {
  const skin = TONE[tone];
  return (
    <View
      style={[styles.base, { backgroundColor: skin.bg }, style]}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}>
      <Text variant="tag" style={{ color: skin.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
