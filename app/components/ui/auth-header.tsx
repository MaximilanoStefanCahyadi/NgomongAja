// The playful half of the auth screens: a navy dome, a cream medallion
// holding the logo, and the Masuk / Daftar toggle.
//
// Three decisions worth keeping:
//
//   • The dome is NAVY, not orange. The brand ratio is 60% cream / 25% navy /
//     10% orange, and orange is reserved for the most important thing in the
//     app — terutama tombol rekam. A full-bleed orange header would spend the
//     entire orange budget on decoration and steal weight from the one button
//     that matters. Navy dome + orange CTA lands the ratio on its own.
//
//   • The medallion is REQUIRED, not decoration. The logo's blue is 2.44:1 on
//     navy and would simply disappear. On cream it is 6.04:1.
//
//   • The greeting sets the tone before a single field is filled. "Ngomong aja"
//     is a permission, so the header says so out loud.

import { useRouter } from 'expo-router';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, gutterFor, radius, spacing } from '@/lib/theme';

import { SegmentedControl } from './segmented-control';
import { Text } from './text';

type AuthRoute = 'login' | 'register';

const MEDALLION = 104;

export type AuthHeaderProps = {
  active: AuthRoute;
  /** Shown in cream on the dome, above the logo. */
  greeting: string;
};

export function AuthHeader({ active, greeting }: AuthHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Cancel <Screen>'s gutter so the dome runs edge to edge.
  const gutter = gutterFor(width);
  // ~19% of the viewport. Deliberately short: the dome is a brand gesture,
  // not the content, and on a form screen every pixel it takes is a field
  // pushed under the keyboard.
  // Floor of 128 leaves 76dp of greeting room once MEDALLION/2 is reserved —
  // enough for two lines of `title` (28dp each) on the shortest screens.
  const domeBody = Math.max(128, Math.min(Math.round(height * 0.19), 168));

  const go = (key: AuthRoute) => {
    if (key === active) return;
    // replace, not push: bouncing between login and register should never
    // build a back stack the user has to unwind.
    router.replace(key === 'login' ? '/(auth)/login' : '/(auth)/register');
  };

  return (
    <View style={{ marginHorizontal: -gutter }}>
      <View
        style={[
          styles.dome,
          // Only the status-bar inset up top; `justifyContent: center` then
          // centres the greeting in what is left AFTER reserving the strip
          // the medallion overlaps. That drops it well clear of the notch.
          { paddingTop: insets.top, height: domeBody + insets.top },
        ]}>
        {/* The screen's only heading now that the screens dropped their
            "Masuk"/"Daftar" intro blocks — so it carries the header role,
            otherwise a screen reader has no landmark to jump to. */}
        <Text
          variant="title"
          color="onDark"
          align="center"
          accessibilityRole="header"
          style={styles.greeting}>
          {greeting}
        </Text>
      </View>

      {/* Pulled up by half its height so it straddles the dome's edge. */}
      <View style={styles.medallionWrap}>
        <View style={styles.medallion}>
          <Image
            source={require('@/assets/images/logo-mark.png')}
            style={styles.logo}
            resizeMode="contain"
            // The screen title below already says the name — announcing the
            // logo too would just repeat it.
            accessible={false}
            importantForAccessibility="no"
          />
        </View>
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
    // Reserve the strip the medallion sits over, so centring the greeting
    // never drops it behind the logo.
    paddingBottom: MEDALLION / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { maxWidth: 260 },
  medallionWrap: { alignItems: 'center', marginTop: -(MEDALLION / 2) },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    // The fill is colors.bg — the same cream as the page — so the shadow is
    // doing real work here, not decoration: it is the only thing giving the
    // lower half of the circle an edge.
    ...elevation.medallion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 68x53 keeps the logo's 1.27:1 landscape ratio undistorted.
  logo: { width: 68, height: 53 },
  toggle: { marginTop: spacing.lg },
});
