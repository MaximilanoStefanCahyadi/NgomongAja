// One horizontal rail of warung cards.
//
// The buyer home shows four of these (paling lengkap, ongkir termurah, rating
// tertinggi, baru buka). They differ only in title, ordering, and the caption
// under each name — so this exists once rather than four near-identical blocks.

import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SectionLabel, Text } from '@/components/ui';
import { specialtyCaption } from '@/lib/specialty';
import type { Store } from '@/lib/stores';
import { colors, radius, spacing } from '@/lib/theme';

/**
 * A rail is hidden below this many entries. One lonely card reads as a bug
 * rather than a recommendation — `Rating tertinggi` hits this until reviews
 * accumulate, and comes back on its own once they do.
 */
const MIN_ENTRIES = 2;

export type StoreRailProps = {
  title: string;
  stores: Store[];
  /** The line under the warung name — the signal this rail ranks on. */
  caption: (store: Store) => string;
  onPressStore: (id: string) => void;
};

export function StoreRail({ title, stores, caption, onPressStore }: StoreRailProps) {
  if (stores.length < MIN_ENTRIES) return null;

  return (
    <View>
      <SectionLabel>{title}</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {stores.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPressStore(s.id)}
            accessibilityRole="button"
            // The caption carries this rail's whole reason for existing, so it
            // belongs in the label, not just on screen.
            accessibilityLabel={`${s.name}. ${caption(s)}`}
            style={styles.card}>
            <View style={styles.tile}>
              <Text variant="bodyStrong" color="linkInk">
                {s.name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text variant="bodyStrong" numberOfLines={2}>
              {s.name}
            </Text>
            <Text variant="tag" color="linkInk" numberOfLines={1}>
              {caption(s)}
            </Text>
            {!!s.specialty?.length && (
              <Text variant="tag" color="secondary" numberOfLines={1}>
                {specialtyCaption(s.specialty)}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Shared by the rail and the home's own chips so they cannot drift apart. */
export function SpecialtyChip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}>
      {!!icon && (
        <Feather name={icon} size={14} color={selected ? colors.onPrimary : colors.bg} />
      )}
      {/* Selected is fill + ink, never fill alone. */}
      <Text variant="tag" color={selected ? 'onPrimary' : 'onDark'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  card: {
    width: 150,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.linkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chips live on the navy panel, so unselected is a translucent lift off navy
  // and selected is the orange fill.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,246,234,0.14)',
  },
  chipSelected: { backgroundColor: colors.primary },
});
