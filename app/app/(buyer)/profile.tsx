import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  ListState,
  Screen,
  ScreenHeader,
  SectionLabel,
  Tag,
  Text,
} from '@/components/ui';
import { listAddresses, type Address } from '@/lib/addresses';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { colors, layout, radius, spacing } from '@/lib/theme';
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
      <Screen centered>
        <ListState state="loading" message="Memuat profilmu…" />
      </Screen>
    );
  }

  if (loadFailed) {
    return (
      <Screen centered>
        <ListState
          state="error"
          title="Gagal memuat"
          message="Periksa koneksi internetmu, lalu coba lagi."
          action={{
            label: 'Coba Lagi',
            onPress: () => {
              setLoaded(false);
              load();
            },
          }}
        />
      </Screen>
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

  const showForm = !verification || (verification.status === 'rejected' && resubmitting);

  return (
    <Screen scroll keyboard contentContainerStyle={styles.content}>
      <ScreenHeader title="Profil Saya" backLabel="Beranda" />

      <Card gap={spacing.sm}>
        <Text variant="title" color="text">
          {profile.full_name}
        </Text>
        <Text variant="meta" color="secondary">
          {profile.phone ?? 'Nomor HP belum diisi'}
        </Text>
        <Tag label="Pembeli" tone="neutral" />
      </Card>

      <SectionLabel>Verifikasi Akun</SectionLabel>

      {verification?.status === 'approved' && (
        // A small "trophy" moment for finishing verification — one toska tint
        // with a left rule, not a tinted card plus a border plus a shadow.
        <Card tone="success" row>
          <Feather name="award" size={22} color={colors.successInk} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" color="success">
              Terverifikasi
            </Text>
            <Text variant="meta" color="success">
              Akunmu sudah tepercaya. Keren!
            </Text>
          </View>
        </Card>
      )}

      {verification?.status === 'pending' && (
        <Card tone="warn" row>
          <Feather name="clock" size={22} color={colors.warnInk} />
          <Text variant="body" color="warn" style={styles.flex}>
            Menunggu peninjauan (diajukan {formatDate(verification.created_at)})
          </Text>
        </Card>
      )}

      {verification?.status === 'rejected' && !resubmitting && (
        <Card tone="danger" gap={spacing.sm}>
          <View style={styles.cardTitleRow}>
            <Feather name="x-circle" size={22} color={colors.dangerInk} />
            <Text variant="bodyStrong" color="danger" style={styles.flex}>
              Verifikasi ditolak
            </Text>
          </View>
          {!!verification.rejection_reason && (
            <Text variant="body" color="body">
              {verification.rejection_reason}
            </Text>
          )}
          <Button
            label="Ajukan Ulang"
            size="md"
            fullWidth={false}
            onPress={() => setResubmitting(true)}
          />
        </Card>
      )}

      {showForm && (
        <Card gap={spacing.md}>
          <Text variant="meta" color="secondary">
            Foto KTP kamu disimpan di tempat privat dan hanya dilihat tim verifikasi. Verifikasi
            memberi lencana Terverifikasi pada akunmu.
          </Text>

          <Field
            label="NIK (16 digit)"
            placeholder="Contoh: 3171234567890001"
            keyboardType="number-pad"
            maxLength={16}
            value={nik}
            onChangeText={(t) => setNik(t.replace(/\D/g, ''))}
            error={nik.length > 0 && !nikValid ? 'NIK harus tepat 16 digit angka.' : undefined}
          />

          <View style={styles.photoBlock}>
            <Text variant="label" color="body">
              Foto KTP
            </Text>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            <Button
              label={imageUri ? 'Ganti Foto KTP' : 'Pilih Foto KTP'}
              icon="camera"
              variant="secondary"
              size="md"
              onPress={pickImage}
            />
          </View>

          <Button
            label="Ajukan Verifikasi"
            onPress={submit}
            loading={submitting}
            disabled={!canSubmit}
          />
        </Card>
      )}

      <SectionLabel>Alamat Tersimpan</SectionLabel>
      {addresses.length === 0 ? (
        <ListState
          state="empty"
          icon="map-pin"
          message="Belum ada alamat tersimpan. Alamat yang kamu pakai saat memesan akan muncul di sini."
        />
      ) : (
        addresses.map((a) => (
          <Card key={a.id} padding="sm" gap={spacing.xs}>
            {!!a.label && (
              <Text variant="label" color="secondary">
                {a.label}
              </Text>
            )}
            <Text variant="body" color="body">
              {a.full_address}
            </Text>
          </Card>
        ))
      )}

      <Pressable
        onPress={signOut}
        style={styles.signOut}
        accessibilityRole="button"
        accessibilityLabel="Keluar dari akun">
        <Text variant="label" color="danger" align="center">
          Keluar
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xxl },
  flex: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoBlock: { gap: spacing.sm },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
  },
  signOut: {
    alignSelf: 'center',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
});
