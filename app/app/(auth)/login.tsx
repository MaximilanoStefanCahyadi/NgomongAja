import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { AuthHeader, Button, Field, Screen, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { layout, spacing } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    // Inline validation instead of an Alert — the message belongs next to
    // the field it is about, not in a modal that hides the form.
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Isi emailmu dulu ya.';
    if (!password) next.password = 'Isi kata sandimu dulu ya.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      // Never "Gagal masuk" — that reads as an accusation. Offer the way out,
      // not the diagnosis.
      Alert.alert('Belum cocok', friendlyError(error));
      return;
    }
    // Success: the AuthProvider picks up the new session automatically;
    // "/" then redirects to the right home based on the profile role.
    router.replace('/');
  };

  return (
    <Screen
      scroll
      keyboard
      edges={{ top: false, bottom: true }}
      contentContainerStyle={styles.page}>
      <AuthHeader active="login" greeting="Selamat datang lagi" />

      <Field
        containerStyle={styles.firstField}
        label="Email"
        placeholder="nama@email.com"
        leftIcon="mail"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        error={errors.email}
      />

      <Field
        label="Kata sandi"
        placeholder="Kata sandi"
        leftIcon="lock"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
        }}
        error={errors.password}
      />

      <Button label="Masuk" onPress={handleLogin} loading={submitting} style={styles.submit} />

      <Link href="/(auth)/register" asChild>
        <Pressable style={styles.linkWrap} accessibilityRole="link">
          <Text variant="meta" color="secondary" align="center">
            Belum punya akun?{' '}
            <Text variant="meta" color="link">
              Daftar di sini
            </Text>
          </Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // No top padding: the dome runs under the status bar and owns the inset.
  page: { paddingTop: 0, gap: spacing.md },
  // The intro block used to space the form off the toggle; it is gone, so
  // the first field carries that gap itself.
  firstField: { marginTop: spacing.lg },
  submit: { marginTop: spacing.sm },
  linkWrap: {
    alignSelf: 'center',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
