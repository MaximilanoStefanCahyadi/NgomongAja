// The playful half of the auth screens: a navy dome carrying a greeting,
// with the Masuk / Daftar toggle underneath.
//
// Two decisions worth keeping:
//
//   • The dome is NAVY, not orange. The brand ratio is 60% cream / 25% navy /
//     10% orange, and orange is reserved for the most important thing in the
//     app — terutama tombol rekam. A full-bleed orange header would spend the
//     entire orange budget on decoration and steal weight from the one button
//     that matters. Navy dome + orange CTA lands the ratio on its own.
//
//   • The greeting sets the tone before a single field is filled. "Ngomong aja"
//     is a permission, so the header says so out loud. It is also the screen's
//     only heading, so it carries the header role.

import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutterFor, spacing } from '@/lib/theme';

import { SegmentedControl } from './segmented-control';
import { Text } from './text';

type AuthRoute = 'login' | 'register';

export type AuthHeaderProps = {
  active: AuthRoute;
  /** Shown in cream on the dome. The screen's only heading. */
  greeting: string;
};

export function AuthHeader({ active, greeting }: AuthHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Cancel <Screen>'s gutter so the dome runs edge to edge.
  const gutter = gutterFor(width);
  // Just enough to hold the greeting. The dome is a brand gesture, not the
  // content — on a form screen every pixel it takes is a field pushed under
  // the keyboard.
  const domeBody = Math.max(96, Math.min(Math.round(height * 0.15), 140));

  const go = (key: AuthRoute) => {
    if (key === active) return;
    // replace, not push: bouncing between login and register should never
    // build a back stack the user has to unwind.
    router.replace(key === 'login' ? '/(auth)/login' : '/(auth)/register');
  };

  return (
    <View style={{ marginHorizontal: -gutter }}>
      <View style={[styles.dome, { paddingTop: insets.top, height: domeBody + insets.top }]}>
        <Text
          variant="title"
          color="onDark"
          align="center"
          accessibilityRole="header"
          style={styles.greeting}>
          {greeting}
        </Text>
      </View>

      <View style={[styles.toggle, { paddingHorizontal: gutter }]}>
        <SegmentedControl<AuthRoute>
          options={[
            { key: 'login', label: 'Masuk' },
            { key: 'register', label: 'Daftar' },
          ]}
          value={active}
          onChange={go}
          // Only two options — never let it collapse into a scroller.
          scrollable={false}
          // Navy, so the orange stays on the one primary button below.
          tone="ink"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dome: {
    backgroundColor: colors.text, // Navy tinta
    // The curve is the playfulness. Everything else stays square.
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { maxWidth: 260 },
  toggle: { marginTop: spacing.md },
});
