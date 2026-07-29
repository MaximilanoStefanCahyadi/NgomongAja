// The little heading above a list.
//
// This existed six times with six different marginTops and an uppercase
// transform plus letterSpacing. Uppercase + tracking is harder to read at
// small sizes, especially for the older users this app targets, so it is
// now sentence case at 14px — and there is one spacing rule, not six.

import { View } from 'react-native';

import { spacing } from '@/lib/theme';

import { Text } from './text';

export type SectionLabelProps = {
  children: string;
  /** Something small on the right: a count, a "Lihat semua" link. */
  right?: React.ReactNode;
  /** First label on a screen usually doesn't need the top gap. */
  first?: boolean;
};

export function SectionLabel({ children, right, first = false }: SectionLabelProps) {
  return (
    <View
      accessibilityRole="header"
      style={{
        marginTop: first ? spacing.lg : spacing.xl,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
      }}>
      <Text variant="label" color="secondary">
        {children}
      </Text>
      {right}
    </View>
  );
}
