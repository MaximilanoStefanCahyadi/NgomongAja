// A row of mutually-exclusive options: recap periods, pickup vs delivery,
// the seller's order status filter.
//
// It becomes horizontally scrollable on narrow phones and, once the user's
// font scale passes 1.3, turns into a stacked radio list — squeezing four
// labels onto a 360dp row at 160% text is unreadable, so we stop trying.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, layout, radius, spacing } from '@/lib/theme';

import { Text } from './text';

export type SegmentedOption<T extends string> = {
  key: T;
  label: string;
  badge?: number;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (key: T) => void;
  scrollable?: boolean;
  /**
   * `ink` fills the selected segment with navy instead of orange. Use it
   * wherever the screen already spends its orange on a primary button —
   * two oranges competing is exactly what the brand ratio forbids.
   */
  tone?: 'primary' | 'ink';
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable,
  tone = 'primary',
}: SegmentedControlProps<T>) {
  const { width, fontScale } = useWindowDimensions();

  const stacked = fontScale >= 1.3;
  const shouldScroll = useMemo(
    () => scrollable ?? (options.length > 3 || width <= 360),
    [scrollable, options.length, width]
  );

  const segments = options.map((opt) => {
    const selected = opt.key === value;
    return (
      <Pressable
        key={opt.key}
        onPress={() => onChange(opt.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={
          opt.badge ? `${opt.label}, ${opt.badge} pesanan` : opt.label
        }
        style={[
          styles.segment,
          stacked && styles.segmentStacked,
          !stacked && !shouldScroll && styles.segmentFlex,
          selected && (tone === 'ink' ? styles.segmentSelectedInk : styles.segmentSelected),
        ]}>
        <Text
          variant="label"
          color={selected ? (tone === 'ink' ? 'onDark' : 'onPrimary') : 'body'}
          numberOfLines={1}>
          {opt.label}
          {opt.badge ? `  ${opt.badge}` : ''}
        </Text>
      </Pressable>
    );
  });

  if (stacked) {
    return (
      <View accessibilityRole="tablist" style={styles.stack}>
        {segments}
      </View>
    );
  }

  if (shouldScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.track}>
        {segments}
      </ScrollView>
    );
  }

  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.sm,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  stack: { gap: spacing.xs },
  segment: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentStacked: {
    minHeight: layout.minTouch,
    backgroundColor: colors.neutralBg,
    alignItems: 'flex-start',
  },
  segmentFlex: { flex: 1, paddingHorizontal: spacing.sm },
  segmentSelected: { backgroundColor: colors.primary },
  segmentSelectedInk: { backgroundColor: colors.text },
});
