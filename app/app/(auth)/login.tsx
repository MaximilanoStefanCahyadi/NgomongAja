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
import { colors, radius, spacing } from '@/lib/theme';

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
      <Text style={styles.title}>NgomongAja</Text>
      <Text style={styles.subtitle}>Belanja di warung, cukup ngomong aja. 🛒</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Kata sandi</Text>
      <TextInput
        style={styles.input}
        placeholder="Kata sandi"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleLogin} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Masuk</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable hitSlop={12} style={styles.linkWrap} accessibilityRole="link">
          <Text style={styles.link}>Belum punya akun? Daftar di sini</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: colors.text },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.body,
    marginBottom: spacing.xl,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.body, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  linkWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: spacing.xs },
  link: { textAlign: 'center', color: colors.primary, fontSize: 14, fontWeight: '600' },
});
