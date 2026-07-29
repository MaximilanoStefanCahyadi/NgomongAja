// Every screen's outer shell.
//
// It absorbs four things that were copy-pasted into all 24 screens:
//   • `paddingTop: insets.top + 12` (safe area)
//   • the horizontal gutter and paper background
//   • KeyboardAvoidingView, which only 4 of 18 form screens actually had
//   • a max content width, so the app doesn't stretch to absurd line
//     lengths on a tablet or an unfolded foldable

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, gutterFor, layout, spacing } from '@/lib/theme';

export type ScreenProps = {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Use for forms and detail screens. */
  scroll?: boolean;
  /** Adds KeyboardAvoidingView. Any screen with a TextInput wants this. */
  keyboard?: boolean;
  /** Sticky bottom bar, separated by a hairline rather than a shadow. */
  footer?: React.ReactNode;
  /** Centre content in the whole viewport — loading and success states. */
  centered?: boolean;
  /** 'primary' is the saturated green voice stage. Everything else is paper. */
  background?: 'paper' | 'primary';
  edges?: { top?: boolean; bottom?: boolean };
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
};

export function Screen({
  children,
  scroll = false,
  keyboard = false,
  footer,
  centered = false,
  background = 'paper',
  edges = { top: true, bottom: false },
  style,
  contentContainerStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const bg = background === 'primary' ? colors.primary : colors.bg;
  const gutter = gutterFor(width);

  const padding: ViewStyle = {
    paddingTop: edges.top ? insets.top + spacing.md : 0,
    paddingBottom: edges.bottom ? insets.bottom + spacing.md : 0,
    paddingHorizontal: gutter,
  };

  // Centre the content column on tablets instead of stretching it.
  const capped: ViewStyle =
    width >= 600 ? { maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center' } : {};

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        padding,
        capped,
        centered && styles.centered,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, capped, centered && styles.centered, style]}>
      {children}
    </View>
  );

  const inner = (
    <>
      {body}
      {footer && (
        <View
          style={[
            styles.footer,
            { paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.md },
          ]}>
          <View style={capped}>{footer}</View>
        </View>
      )}
    </>
  );

  if (keyboard) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.flex, { backgroundColor: bg }]}>{inner}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  footer: {
    ...elevation.bar,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },
});
