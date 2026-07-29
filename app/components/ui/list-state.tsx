// Loading / empty / error, in one place.
//
// The old screens each rolled their own, so "Coba Lagi" appeared as a green
// pill on one screen and a grey outline on the next. It also replaces the
// decorative emoji (🧾, ⏳, ❌) with Feather icons, which inherit our colours
// and don't get read aloud as "receipt" mid-sentence by TalkBack.

import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

import { Button } from './button';
import { Text } from './text';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type ListStateProps = {
  state: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  icon?: FeatherName;
  action?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
};

export function ListState({
  state,
  title,
  message,
  icon,
  action,
  secondaryAction,
}: ListStateProps) {
  if (state === 'loading') {
    return (
      <View style={styles.wrap} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primaryInk} />
        {!!(message ?? title) && (
          <Text variant="body" color="body" align="center">
            {message ?? title}
          </Text>
        )}
      </View>
    );
  }

  const fallbackIcon: FeatherName = state === 'error' ? 'wifi-off' : 'inbox';

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Feather name={icon ?? fallbackIcon} size={26} color={colors.secondary} />
      </View>
      {!!title && (
        <Text variant="title" color="text" align="center">
          {title}
        </Text>
      )}
      {!!message && (
        <Text variant="body" color="body" align="center">
          {message}
        </Text>
      )}
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          size="md"
          fullWidth={false}
          style={styles.action}
        />
      )}
      {secondaryAction && (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="quiet"
          size="md"
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { marginTop: spacing.xs },
});
