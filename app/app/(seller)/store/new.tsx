import * as Location from 'expo-location';
import { router } from 'expo-router';
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

import { useAuth } from '@/lib/auth-context';
import { createStore } from '@/lib/stores';

export default function NewStore() {
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
    } catch (e: any) {
      Alert.alert('Gagal membuat toko', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Toko Baru</Text>

      <TextInput
        style={styles.input}
        placeholder="Nama toko (contoh: Warung Bu Rina)"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Deskripsi singkat (opsional)"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Lokasi toko</Text>
      <Pressable style={styles.locationButton} onPress={useMyLocation} disabled={locating}>
        {locating ? (
          <ActivityIndicator />
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
        autoCapitalize="none"
        value={gmapsUrl}
        onChangeText={setGmapsUrl}
      />
      <Text style={styles.hint}>
        Tips: tekan tombol lokasi saat kamu sedang berada di toko, supaya pembeli
        menemukan alamat yang benar.
      </Text>

      <Pressable style={styles.button} onPress={handleCreate} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Buat Toko</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Batal</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  label: { fontSize: 14, color: '#444', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  locationButton: {
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  locationButtonText: { color: '#15803d', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, color: '#888', lineHeight: 17 },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { textAlign: 'center', color: '#666', marginTop: 16, fontSize: 14 },
});
