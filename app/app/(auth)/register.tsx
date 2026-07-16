import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/lib/theme';

type Role = 'buyer' | 'seller';

export default function Register() {
  const [role, setRole] = useState<Role>('buyer');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      Alert.alert('NgomongAja', 'Semua kolom wajib diisi ya.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('NgomongAja', 'Kata sandi minimal 8 karakter.');
      return;
    }

    setSubmitting(true);
    // options.data becomes raw_user_meta_data — the handle_new_user trigger
    // in the database reads it to create the profiles row (role, name, phone).
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { role, full_name: fullName.trim(), phone: phone.trim() },
      },
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Gagal daftar', friendlyError(error));
      return;
    }

    if (!data.session) {
      // Email confirmation is turned on in Supabase: no session until the
      // user clicks the link in their inbox.
      Alert.alert(
        'Cek email kamu',
        'Kami sudah mengirim tautan konfirmasi. Buka email itu, lalu masuk di sini.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Daftar</Text>

        <Text style={styles.label}>Saya mau daftar sebagai:</Text>
        <Pressable
          style={[styles.roleOption, role === 'buyer' && styles.roleSelected]}
          onPress={() => setRole('buyer')}
          accessibilityRole="button"
          accessibilityState={{ selected: role === 'buyer' }}>
          <Text style={styles.roleTitle}>Pembeli</Text>
          <Text style={styles.roleDesc}>Belanja ke warung dekat rumah pakai suara</Text>
        </Pressable>
        <Pressable
          style={[styles.roleOption, role === 'seller' && styles.roleSelected]}
          onPress={() => setRole('seller')}
          accessibilityRole="button"
          accessibilityState={{ selected: role === 'seller' }}>
          <Text style={styles.roleTitle}>Penjual</Text>
          <Text style={styles.roleDesc}>Kelola warung dan terima pesanan suara</Text>
        </Pressable>

        <Text style={styles.label}>Nama lengkap</Text>
        <TextInput
          style={styles.input}
          placeholder="Nama lengkap"
          value={fullName}
          onChangeText={setFullName}
        />
        <Text style={styles.label}>Nomor HP</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 08123456789"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
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
          placeholder="Minimal 8 karakter"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.button} onPress={handleRegister} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Daftar</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={12} style={styles.linkWrap} accessibilityRole="link">
            <Text style={styles.link}>Sudah punya akun? Masuk</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.body, marginTop: spacing.xs },
  roleOption: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.card,
  },
  roleSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  roleDesc: { fontSize: 13, color: colors.body, marginTop: 2 },
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
