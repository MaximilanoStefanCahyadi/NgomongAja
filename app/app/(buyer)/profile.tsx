import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { listAddresses, type Address } from '@/lib/addresses';
import { useAuth } from '@/lib/auth-context';
import { getMyVerification, submitVerification, type Verification } from '@/lib/verification';

// "2026-07-15T…" -> "15 Jul 2026"
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BuyerProfile() {
  const { profile, signOut } = useAuth();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);

  // KTP form state
  const [nik, setNik] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      getMyVerification(profile.id)
        .then(setVerification)
        .catch((e) => console.warn('getMyVerification:', e.message))
        .finally(() => setLoaded(true));
      listAddresses(profile.id)
        .then(setAddresses)
        .catch((e) => console.warn('listAddresses:', e.message));
    }, [profile])
  );

  if (!profile || !loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const nikValid = /^\d{16}$/.test(nik);
  const canSubmit = nikValid && !!imageUri && !submitting;

  const submit = async () => {
    if (!canSubmit || !imageUri) return;
    setSubmitting(true);
    try {
      await submitVerification(profile.id, nik, imageUri);
      const fresh = await getMyVerification(profile.id);
      setVerification(fresh);
      setNik('');
      setImageUri(null);
      setResubmitting(false);
    } catch (e: any) {
      Alert.alert('Gagal mengajukan verifikasi', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showForm =
    !verification || (verification.status === 'rejected' && resubmitting);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Beranda</Text>
      </Pressable>
      <Text style={styles.title}>Profil Saya</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.meta}>{profile.phone ?? 'Nomor HP belum diisi'}</Text>
        <Text style={styles.roleBadge}>Pembeli</Text>
      </View>

      <Text style={styles.sectionTitle}>Verifikasi Akun</Text>

      {verification?.status === 'approved' && (
        <View style={styles.approvedBox}>
          <Text style={styles.approvedText}>✅ Terverifikasi</Text>
        </View>
      )}

      {verification?.status === 'pending' && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>
            ⏳ Menunggu peninjauan (diajukan {formatDate(verification.created_at)})
          </Text>
        </View>
      )}

      {verification?.status === 'rejected' && !resubmitting && (
        <View style={styles.rejectedBox}>
          <Text style={styles.rejectedTitle}>❌ Verifikasi ditolak</Text>
          {!!verification.rejection_reason && (
            <Text style={styles.rejectedReason}>{verification.rejection_reason}</Text>
          )}
          <Pressable style={styles.button} onPress={() => setResubmitting(true)}>
            <Text style={styles.buttonText}>Ajukan Ulang</Text>
          </Pressable>
        </View>
      )}

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.privacy}>
            Foto KTP kamu disimpan terenkripsi dan hanya dilihat tim verifikasi. Verifikasi
            memberi lencana Terverifikasi pada akunmu.
          </Text>

          <Text style={styles.label}>NIK (16 digit)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: 3171234567890001"
            keyboardType="number-pad"
            maxLength={16}
            value={nik}
            onChangeText={(t) => setNik(t.replace(/\D/g, ''))}
          />
          {nik.length > 0 && !nikValid && (
            <Text style={styles.warn}>NIK harus tepat 16 digit angka.</Text>
          )}

          <Text style={styles.label}>Foto KTP</Text>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
          <Pressable style={styles.outlineButton} onPress={pickImage}>
            <Text style={styles.outlineButtonText}>
              {imageUri ? 'Ganti Foto KTP' : '📷 Pilih Foto KTP'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Ajukan Verifikasi</Text>
            )}
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionTitle}>Alamat Tersimpan</Text>
      {addresses.length === 0 ? (
        <Text style={styles.empty}>Belum ada alamat tersimpan.</Text>
      ) : (
        addresses.map((a) => (
          <View key={a.id} style={styles.addressCard}>
            {!!a.label && <Text style={styles.addressLabel}>{a.label}</Text>}
            <Text style={styles.addressText}>{a.full_address}</Text>
          </View>
        ))
      )}

      <Pressable onPress={signOut}>
        <Text style={styles.signOut}>Keluar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 10 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 14, color: '#666' },
  roleBadge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10 },
  approvedBox: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  approvedText: { color: '#15803d', fontWeight: '700', fontSize: 15 },
  pendingBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingText: { color: '#92400e', fontSize: 14, lineHeight: 20 },
  rejectedBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  rejectedTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 15 },
  rejectedReason: { color: '#b91c1c', fontSize: 14, lineHeight: 20 },
  privacy: {
    fontSize: 13,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    lineHeight: 19,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  warn: { color: '#b45309', fontSize: 12 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  outlineButtonText: { color: '#15803d', fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: '#a7cbb4' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { color: '#666', fontSize: 14 },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 2,
  },
  addressLabel: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  addressText: { fontSize: 14, color: '#444', lineHeight: 20 },
  signOut: { textAlign: 'center', color: '#dc2626', marginTop: 16, fontSize: 14 },
});
