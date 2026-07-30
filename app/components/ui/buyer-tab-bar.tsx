// The buyer's floating bottom bar.
//
//   ╭──────────────────────────────────────╮
//   │  ⌂       ⏲     ◉███◉    🔍      ○   │
//   │Beranda Riwayat  MIC    Cari   Saya   │
//   ╰──────────────────────────────────────╯
//
// The centre is a raised orange mic. It is NOT a tab — it is an action, and
// it is labelled as one, because voice ordering needs a store and the app has
// to ask which warung first. The four real tabs sit either side.
//
// Why the mic and not the logo: the logo is #F2811D + #1B5FA8, and on an
// orange fill its arc is 1.00:1 — invisible. Past that, this button's job is
// to tell a 40+ first-time user what happens next, and a mic says "talk".

import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, layout, radius, spacing } from '@/lib/theme';

import { Text } from './text';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const ICONS: Record<string, FeatherName> = {
  index: 'home',
  orders: 'clock',
  search: 'search',
  profile: 'user',
};

const LABELS: Record<string, string> = {
  index: 'Beranda',
  orders: 'Riwayat',
  search: 'Cari',
  profile: 'Saya',
};

/** Tab order around the centre action. */
const LEFT = ['index', 'orders'];
const RIGHT = ['search', 'profile'];

export type BuyerTabBarProps = BottomTabBarProps & {
  /** Opens the "warung mana?" picker. */
  onMicPress: () => void;
};

export function BuyerTabBar({ state, navigation, onMicPress }: BuyerTabBarProps) {
  const insets = useSafeAreaInsets();

  const routeByName = new Map(state.routes.map((r) => [r.name, r]));
  const activeName = state.routes[state.index]?.name;

  const renderTab = (name: string) => {
    const route = routeByName.get(name);
    if (!route) return null;
    const focused = activeName === name;

    return (
      <Pressable
        key={name}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={LABELS[name]}
        style={styles.tab}>
        <Feather
          name={ICONS[name]}
          size={22}
          color={focused ? colors.text : colors.secondary}
        />
        {/* The label repeats the icon on purpose: icon-only bars are a known
            problem for older users, who read the word first. */}
        <Text variant="tag" color={focused ? 'text' : 'secondary'} numberOfLines={1}>
          {LABELS[name]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
      {LEFT.map(renderTab)}

      <Pressable
        onPress={onMicPress}
        // "button", not "tab" — it opens a picker, it does not switch screens.
        accessibilityRole="button"
        accessibilityLabel="Pesan pakai suara"
        accessibilityHint="Pilih warung dulu, lalu sebutkan belanjaanmu"
        style={({ pressed }) => [styles.micWrap, pressed && styles.micPressed]}>
        <View style={styles.mic}>
          <Feather name="mic" size={26} color={colors.onPrimary} />
        </View>
      </Pressable>

      {RIGHT.map(renderTab)}
    </View>
  );
}

const MIC = 60;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...elevation.bar,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.xs,
  },
  // Lifts the mic above the bar line. The cream ring is what reads as a
  // "cut-out" in the bar rather than a button sitting on top of it.
  micWrap: {
    width: MIC + 10,
    height: MIC + 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -(MIC / 2),
  },
  micPressed: { opacity: 0.9 },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.raised,
  },
});
