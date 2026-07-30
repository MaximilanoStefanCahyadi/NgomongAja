import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { SPECIALTIES } from '@/lib/specialty';
import { createStore } from '@/lib/stores';
import { colors, layout, radius, spacing } from '@/lib/theme';

type Errors = Partial<Record<'name' | 'location', string>>;

export default function NewStore() {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [specialty, setSpecialty] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

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
      clear('location');
    } catch {
      Alert.alert('NgomongAja', 'Gagal membaca lokasi. Coba lagi atau isi link Google Maps.');
    } finally {
      setLocating(false);
    }
  };

  const handleCreate = async () => {
    if (!profile) return;

    const next: Errors = {};
    if (!name.trim()) next.name = 'Nama toko wajib diisi.';
    if (!coords && !gmapsUrl.trim()) {
      next.location =
        'Isi lokasi tokomu: tekan "Gunakan lokasi saat ini" (saat kamu sedang di toko) atau tempel link Google Maps.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const store = await createStore(profile.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        gmaps_url: gmapsUrl.trim() || undefined,
        specialty,
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
    <Screen
      scroll
      keyboard
      contentContainerStyle={styles.form}
      footer={<Button label="Buat Toko" onPress={handleCreate} loading={submitting} />}>
      <ScreenHeader title="Toko Baru" backLabel="Toko Saya" />

      <Field
        label="Nama toko"
        placeholder="Contoh: Warung Bu Rina"
        value={name}
        onChangeText={(t) => {
          setName(t);
          clear('name');
        }}
        error={errors.name}
      />
      <Field
        label="Deskripsi singkat (opsional)"
        placeholder="Contoh: Sembako lengkap, buka 06.00–21.00"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      <View style={styles.locationGroup}>
        <Text variant="label" color="body">
          Lokasi toko
        </Text>
        <Button
          label={coords ? 'Lokasi tersimpan' : 'Gunakan lokasi saat ini'}
          icon={coords ? 'check' : 'map-pin'}
          variant="secondary"
          size="md"
          onPress={useMyLocation}
          loading={locating}
        />
        {coords && (
          <Text variant="meta" color="secondary">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
        <Field
          placeholder="Atau tempel link Google Maps (opsional)"
          autoCapitalize="none"
          keyboardType="url"
          accessibilityLabel="Link Google Maps"
          value={gmapsUrl}
          onChangeText={(t) => {
            setGmapsUrl(t);
            clear('location');
          }}
          error={errors.location}
          hint={
            errors.location
              ? undefined
              : 'Tips: tekan tombol lokasi saat kamu sedang berada di toko, supaya pembeli menemukan alamat yang benar.'
          }
        />
      </View>

      <View style={styles.specialtyBlock}>
        <Text variant="label" color="body">
          Warungmu terkenal apa? (opsional)
        </Text>
        <Text variant="meta" color="secondary">
          Pembeli pakai ini buat nyaring warung. Bisa diubah nanti.
        </Text>
        <View style={styles.specialtyWrap}>
          {SPECIALTIES.map((sp) => {
            const on = specialty.includes(sp.slug);
            return (
              <Pressable
                key={sp.slug}
                onPress={() =>
                  setSpecialty(
                    on ? specialty.filter((t) => t !== sp.slug) : [...specialty, sp.slug]
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={sp.label}
                style={[styles.specialtyChip, on && styles.specialtyChipOn]}>
                <Feather
                  name={on ? 'check' : sp.icon}
                  size={14}
                  color={on ? colors.primaryInk : colors.secondary}
                />
                <Text variant="tag" color={on ? 'primaryInk' : 'body'}>
                  {sp.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={styles.cancel}
        accessibilityRole="button"
        accessibilityLabel="Batal, kembali tanpa membuat toko">
        <Text variant="label" color="body" align="center">
          Batal
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xl },
  locationGroup: { gap: spacing.sm },
  specialtyBlock: { gap: spacing.xs },
  specialtyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  specialtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
  },
  specialtyChipOn: { backgroundColor: colors.primarySoft },
  cancel: {
    alignSelf: 'center',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
