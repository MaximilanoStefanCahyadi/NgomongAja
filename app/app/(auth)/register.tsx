import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { supabase } from '@/lib/supabase';

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
      Alert.alert('Gagal daftar', error.message);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Daftar</Text>

      <Text style={styles.label}>Saya mau daftar sebagai:</Text>
      <Pressable
        style={[styles.roleOption, role === 'buyer' && styles.roleSelected]}
        onPress={() => setRole('buyer')}>
        <Text style={styles.roleTitle}>Pembeli</Text>
        <Text style={styles.roleDesc}>Belanja ke warung dekat rumah pakai suara</Text>
      </Pressable>
      <Pressable
        style={[styles.roleOption, role === 'seller' && styles.roleSelected]}
        onPress={() => setRole('seller')}>
        <Text style={styles.roleTitle}>Penjual</Text>
        <Text style={styles.roleDesc}>Kelola warung dan terima pesanan suara</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Nama lengkap"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Nomor HP (contoh: 08123456789)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Kata sandi (min. 8 karakter)"
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

      <Link href="/(auth)/login" style={styles.link}>
        Sudah punya akun? Masuk
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  label: { fontSize: 14, color: '#444' },
  roleOption: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  roleSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  roleTitle: { fontSize: 16, fontWeight: '600' },
  roleDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#16a34a', marginTop: 16, fontSize: 14 },
});
