// A list row: leading thing, title + meta, trailing thing or a value.
//
// `minHeight`, never `height` — at a 1.6 font scale a fixed-height row
// clips its own text. When the font scale goes past 1.3, the trailing
// content drops below the title instead of squeezing it to two characters.

import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { layout, spacing } from '@/lib/theme';

import { Text } from './text';

export type RowProps = {
  title: string;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Right-aligned money/value, rendered with tabular figures. */
  value?: string;
  onPress?: () => void;
  /** 'total' bumps both sides to title size for a summary line. */
  emphasis?: 'normal' | 'total';
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Row({
  title,
  meta,
  leading,
  trailing,
  value,
  onPress,
  emphasis = 'normal',
  accessibilityLabel,
  style,
}: RowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.3;

  const titleVariant = emphasis === 'total' ? 'title' : 'bodyStrong';
  const valueVariant = emphasis === 'total' ? 'title' : 'money';

  const right = value ? (
    <Text variant={valueVariant} color="text" numberOfLines={1}>
      {value}
    </Text>
  ) : (
    trailing
  );

  const content = (
    <View style={[styles.base, stacked && styles.stacked, style]}>
      <View style={[styles.main, stacked && styles.mainStacked]}>
        {leading}
        <View style={styles.labels}>
          <Text variant={titleVariant} color="text" numberOfLines={2}>
            {title}
          </Text>
          {!!meta && (
            <Text variant="meta" color="secondary" numberOfLines={2}>
              {meta}
            </Text>
          )}
        </View>
      </View>
      {right != null && <View style={stacked ? styles.rightStacked : undefined}>{right}</View>}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}${meta ? `, ${meta}` : ''}`}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  mainStacked: { flex: 0 },
  labels: { flex: 1, minWidth: 0, gap: 2 },
  rightStacked: { alignItems: 'flex-start' },
  pressed: { opacity: 0.7 },
});
