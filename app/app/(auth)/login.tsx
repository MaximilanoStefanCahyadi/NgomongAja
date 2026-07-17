import { Feather } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, spacing } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('NgomongAja', 'Isi email dan kata sandi dulu ya.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Gagal masuk', friendlyError(error));
      return;
    }
    // Success: the AuthProvider picks up the new session automatically;
    // "/" then redirects to the right home based on the profile role.
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Feather name="mic" size={40} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>NgomongAja</Text>
        <Text style={styles.subtitle}>Belanja di warung, cukup ngomong aja.</Text>
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.secondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Kata sandi</Text>
      <TextInput
        style={styles.input}
        placeholder="Kata sandi"
        placeholderTextColor={colors.secondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleLogin}
        disabled={submitting}
        accessibilityRole="button">
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Masuk</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable hitSlop={12} style={styles.linkWrap} accessibilityRole="link">
          <Text style={styles.linkMuted}>
            Belum punya akun? <Text style={styles.link}>Daftar di sini</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  brand: { alignItems: 'center', gap: 14, marginBottom: 18 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  title: { fontFamily: fonts.heading, fontSize: 34, color: colors.text },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    textAlign: 'center',
    color: colors.secondary,
    lineHeight: 22,
  },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.body, marginTop: spacing.xs },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontFamily: fonts.heading },
  linkWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: spacing.xs },
  linkMuted: { fontFamily: fonts.body, color: colors.secondary, fontSize: 14 },
  link: { color: colors.primaryDark, fontFamily: fonts.bodyBold },
});
