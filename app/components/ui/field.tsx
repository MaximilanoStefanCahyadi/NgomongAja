// A labelled text input.
//
// Three fixes are baked in here that every screen was getting wrong:
//   • The old border was colors.border at 1.28:1 against the card — a
//     sighted user genuinely could not see where the input was. It now uses
//     `inputBorder` (3.15:1), which is the non-text AA threshold.
//   • fontSize 16, not 15. Below 16px iOS zooms the whole page on focus.
//   • Errors render inline with a live region instead of Alert.alert(),
//     so the message sits next to the field it is about.

import { Feather } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/lib/theme';

import { Text } from './text';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: FeatherName;
  /** A trailing text button inside the row — "Ubah", "Simpan". */
  rightAction?: { label: string; onPress: () => void };
  containerStyle?: ViewStyle;
};

// forwardRef so screens can call `ref.current?.focus()` — the seller's
// "Simpan & Tambah Lagi" loop needs to jump back to the name field.
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  {
    label,
    hint,
    error,
    leftIcon,
    rightAction,
    containerStyle,
    multiline,
    style,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.inputBorder;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label && (
        <Text variant="label" color="body">
          {label}
        </Text>
      )}

      <View
        style={[
          styles.box,
          { borderColor, borderWidth: focused || error ? 2 : 1 },
          multiline && styles.boxMultiline,
        ]}>
        {leftIcon && <Feather name={leftIcon} size={18} color={colors.secondary} />}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.secondary}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          maxFontSizeMultiplier={1.6}
          {...rest}
        />
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            accessibilityRole="button"
            style={styles.rightAction}>
            <Text variant="label" color="primary">
              {rightAction.label}
            </Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <Text
          variant="meta"
          color="danger"
          accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="meta" color="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    minHeight: layout.minTouch,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  rightAction: {
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
});
