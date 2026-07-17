import * as Location from 'expo-location';
import { router } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { createStore } from '@/lib/stores';
import { colors, fonts, radius, scrollWrap } from '@/lib/theme';

export default function NewStore() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      // Android/iOS require asking permission before reading GPS.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('NgomongAja', 'Izin lokasi ditolak. Kamu bisa isi link Google Maps saja.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert('NgomongAja', 'Gagal membaca lokasi. Coba lagi atau isi link Google Maps.');
    } finally {
      setLocating(false);
    }
  };

  const handleCreate = async () => {
    if (!profile) return;
    if (!name.trim()) {
      Alert.alert('NgomongAja', 'Nama toko wajib diisi.');
      return;
    }
    if (!coords && !gmapsUrl.trim()) {
      Alert.alert(
        'NgomongAja',
        'Isi lokasi tokomu: tekan "Gunakan lokasi saat ini" (saat kamu sedang di toko) atau tempel link Google Maps.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const store = await createStore(profile.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        gmaps_url: gmapsUrl.trim() || undefined,
      });
      // replace (not push): "back" from the store page should go to the list,
      // not return to this already-submitted form.
      router.replace({ pathname: '/(seller)/store/[id]', params: { id: store.id } });
    } catch (e) {
      Alert.alert('Gagal membuat toko', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>‹ Toko Saya</Text>
        </Pressable>
        <Text style={styles.title}>Toko Baru 🏪</Text>

        <Text style={styles.label}>Nama toko</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: Warung Bu Rina"
          placeholderTextColor={colors.secondary}
          value={name}
          onChangeText={setName}
        />
        <Text style={styles.label}>Deskripsi singkat (opsional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Contoh: Sembako lengkap, buka 06.00–21.00"
          placeholderTextColor={colors.secondary}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Lokasi toko</Text>
        <Pressable
          style={styles.locationButton}
          onPress={useMyLocation}
          disabled={locating}
          accessibilityRole="button">
          {locating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.locationButtonText}>
              {coords
                ? `✓ Lokasi tersimpan (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
                : '📍 Gunakan lokasi saat ini'}
            </Text>
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Atau tempel link Google Maps (opsional)"
          placeholderTextColor={colors.secondary}
          autoCapitalize="none"
          value={gmapsUrl}
          onChangeText={setGmapsUrl}
        />
        <Text style={styles.hint}>
          Tips: tekan tombol lokasi saat kamu sedang berada di toko, supaya pembeli
          menemukan alamat yang benar.
        </Text>

        <Pressable
          style={styles.button}
          onPress={handleCreate}
          disabled={submitting}
          accessibilityRole="button">
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Buat Toko</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Batal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { ...scrollWrap, gap: 12 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: fonts.heading, marginBottom: 8, color: colors.text },
  label: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.body, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  locationButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  locationButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.secondary, lineHeight: 17 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  cancelWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: 8 },
  cancel: { textAlign: 'center', color: colors.body, fontSize: 14 },
});
