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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAddresses, type Address } from '@/lib/addresses';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { colors, radius, scrollWrap, spacing } from '@/lib/theme';
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
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);

  // KTP form state
  const [nik, setNik] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const load = useCallback(() => {
    if (!profile) return;
    setLoadFailed(false);
    getMyVerification(profile.id)
      .then(setVerification)
      .catch((e) => {
        console.warn('getMyVerification:', e.message);
        setLoadFailed(true);
      })
      .finally(() => setLoaded(true));
    listAddresses(profile.id)
      .then(setAddresses)
      .catch((e) => console.warn('listAddresses:', e.message));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!profile || !loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Gagal memuat. Periksa internetmu.</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            setLoaded(false);
            load();
          }}
          accessibilityRole="button">
          <Text style={styles.buttonText}>Coba Lagi</Text>
        </Pressable>
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
    } catch (e) {
      Alert.alert('Gagal mengajukan verifikasi', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const showForm =
    !verification || (verification.status === 'rejected' && resubmitting);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
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
        // Achievement chip — a small "trophy" moment for finishing verification.
        <View style={styles.achievementChip}>
          <Text style={styles.achievementEmoji}>🏅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.achievementTitle}>Terverifikasi</Text>
            <Text style={styles.achievementDesc}>Akunmu sudah tepercaya. Keren!</Text>
          </View>
          <Text style={styles.achievementSpark}>✨</Text>
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
            <Text style={styles.warn}>⚠️ NIK harus tepat 16 digit angka.</Text>
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

      <Pressable onPress={signOut} hitSlop={12} style={styles.signOutWrap}>
        <Text style={styles.signOut}>Keluar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  errorText: { color: colors.body, fontSize: 15, textAlign: 'center' },
  container: { ...scrollWrap, gap: 10 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  name: { fontSize: 18, fontWeight: '600', color: colors.text },
  meta: { fontSize: 14, color: colors.body },
  roleBadge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    backgroundColor: colors.primaryChipBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10, color: colors.text },
  achievementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryChipBg,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.amberSoftBorder,
    shadowColor: colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  achievementEmoji: { fontSize: 28 },
  achievementTitle: { color: colors.primaryDark, fontWeight: '800', fontSize: 16 },
  achievementDesc: { color: colors.primaryDark, fontSize: 13, marginTop: 1 },
  achievementSpark: { fontSize: 18 },
  pendingBox: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingText: { color: colors.amberText, fontSize: 14, lineHeight: 20 },
  rejectedBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    gap: spacing.sm,
  },
  rejectedTitle: { color: colors.dangerDark, fontWeight: '700', fontSize: 15 },
  rejectedReason: { color: colors.dangerDark, fontSize: 14, lineHeight: 20 },
  privacy: {
    fontSize: 13,
    color: colors.amberText,
    backgroundColor: colors.amberBg,
    borderRadius: radius.sm,
    padding: 12,
    lineHeight: 19,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.body, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.card,
    color: colors.text,
  },
  warn: { color: '#b45309', fontSize: 15 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  outlineButtonText: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  empty: { color: colors.body, fontSize: 14 },
  addressCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  addressLabel: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  addressText: { fontSize: 14, color: colors.body, lineHeight: 20 },
  signOutWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: spacing.sm },
  signOut: { textAlign: 'center', color: colors.danger, fontSize: 14, fontWeight: '600' },
});
