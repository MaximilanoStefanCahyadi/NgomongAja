import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AuthHeader, Button, Field, Screen, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { createStore } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, layout, radius, spacing } from '@/lib/theme';

type Role = 'buyer' | 'seller';

type Errors = Partial<
  Record<'fullName' | 'phone' | 'email' | 'password' | 'storeName' | 'storeLocation', string>
>;

// The descriptions carry each role's voice: "kak" for the buyer, "kamu" for
// the warung owner. That difference starts here, before the account exists.
// Kept short — these sit in a half-width column on a 360dp phone.
const ROLES: { key: Role; title: string; desc: string; icon: 'shopping-bag' | 'home' }[] = [
  {
    key: 'buyer',
    title: 'Pembeli',
    desc: 'Kak, belanja cukup ngomong',
    icon: 'shopping-bag',
  },
  {
    key: 'seller',
    title: 'Punya warung',
    desc: 'Kamu terima pesanan masuk',
    icon: 'home',
  },
];

export default function Register() {
  const [role, setRole] = useState<Role>('buyer');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Warung fields — only collected, validated and sent when role is 'seller'.
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  // Two half-width cards stop working once the text is scaled up, so past
  // 1.3 they go back to full-width rows — same threshold SegmentedControl uses.
  const { fontScale } = useWindowDimensions();
  const stackRoles = fontScale >= 1.3;

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickRole = (key: Role) => {
    setRole(key);
    // Switching back to Pembeli must not leave warung errors on screen for
    // fields that are no longer shown.
    if (key === 'buyer') {
      setErrors((e) => ({ ...e, storeName: undefined, storeLocation: undefined }));
    }
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
      clear('storeLocation');
    } catch {
      Alert.alert('NgomongAja', 'Gagal membaca lokasi. Coba lagi atau isi link Google Maps.');
    } finally {
      setLocating(false);
    }
  };

  const handleRegister = async () => {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = 'Isi nama lengkapmu ya.';
    if (!phone.trim()) next.phone = 'Isi nomor HP-mu ya.';
    if (!email.trim()) next.email = 'Isi emailmu ya.';
    if (!password) next.password = 'Isi kata sandimu ya.';
    else if (password.length < 8) next.password = 'Kata sandi minimal 8 karakter.';

    const isSeller = role === 'seller';
    if (isSeller) {
      if (!storeName.trim()) next.storeName = 'Isi nama warungmu ya.';
      if (!coords && !gmapsUrl.trim()) {
        next.storeLocation =
          'Isi lokasi warungmu: tekan "Gunakan lokasi saat ini" (saat kamu sedang di warung) atau tempel link Google Maps.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

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

    if (error) {
      setSubmitting(false);
      Alert.alert('Belum jadi', friendlyError(error));
      return;
    }

    if (!data.session) {
      setSubmitting(false);
      // Email confirmation is turned on in Supabase: no session until the user
      // clicks the link. The stores RLS policy is TO authenticated, so the
      // warung cannot be created yet — say so instead of losing it silently.
      Alert.alert(
        'Cek email kamu',
        isSeller
          ? 'Kami sudah mengirim tautan konfirmasi. Buka email itu, masuk di sini, lalu warungmu tinggal dibuat sebentar.'
          : 'Kami sudah mengirim tautan konfirmasi. Buka email itu, lalu masuk di sini.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
      return;
    }

    if (isSeller && data.user) {
      try {
        await createStore(data.user.id, {
          name: storeName.trim(),
          description: storeDesc.trim() || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          gmaps_url: gmapsUrl.trim() || undefined,
        });
      } catch (e) {
        setSubmitting(false);
        // The account already exists. Telling them registration failed would
        // send them back to sign up again and straight into "email sudah
        // punya akun". Say what actually happened and let them in.
        Alert.alert(
          'Akunmu sudah jadi',
          `Cuma warungnya belum tersimpan: ${friendlyError(e)} Kamu bisa buat warungnya sekarang di halaman Toko Saya.`,
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        return;
      }
    }

    setSubmitting(false);
    // "/" redirects by role, so the seller lands on Toko Saya with the warung
    // they just created already in the list.
    router.replace('/');
  };

  return (
    <Screen
      scroll
      keyboard
      edges={{ top: false, bottom: true }}
      contentContainerStyle={styles.page}>
      <AuthHeader active="register" greeting="Bikin akun dulu ya" />

      <Text variant="label" color="body" style={styles.firstLabel}>
        Mau daftar sebagai apa?
      </Text>
      <View accessibilityRole="radiogroup" style={[styles.roles, !stackRoles && styles.rolesRow]}>
        {ROLES.map((r) => {
          const selected = role === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => pickRole(r.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${r.title}. ${r.desc}`}
              style={[
                styles.role,
                !stackRoles && styles.roleColumn,
                selected && styles.roleSelected,
              ]}>
              <View style={styles.roleTop}>
                <Feather
                  name={r.icon}
                  size={22}
                  color={selected ? colors.primaryInk : colors.secondary}
                />
                {/* The check is a second signal for the fill, not a replacement
                    for it — colour alone must never carry the selected state. */}
                {selected && <Feather name="check" size={20} color={colors.primaryInk} />}
              </View>
              <Text variant="bodyStrong" color={selected ? 'primaryInk' : 'text'}>
                {r.title}
              </Text>
              <Text variant="meta" color={selected ? 'primaryInk' : 'secondary'}>
                {r.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Nama lengkap"
        placeholder="Nama lengkap"
        leftIcon="user"
        autoComplete="name"
        textContentType="name"
        value={fullName}
        onChangeText={(t) => {
          setFullName(t);
          clear('fullName');
        }}
        error={errors.fullName}
      />
      <Field
        label="Nomor HP"
        placeholder="Contoh: 08123456789"
        leftIcon="phone"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          clear('phone');
        }}
        error={errors.phone}
      />
      <Field
        label="Email"
        placeholder="nama@email.com"
        leftIcon="mail"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clear('email');
        }}
        error={errors.email}
      />
      <Field
        label="Kata sandi"
        placeholder="Minimal 8 karakter"
        leftIcon="lock"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clear('password');
        }}
        error={errors.password}
        hint={errors.password ? undefined : 'Minimal 8 karakter.'}
      />

      {/* Appended rather than slotted next to the role cards: toggling the
          role then only adds fields below what has already been filled in,
          instead of shoving them down the screen.

          It gets its own surface rather than just a heading — this is a
          second subject on the same form. The panel is warm sand and the
          inputs stay white, so the fields read clearly against it. */}
      {role === 'seller' && (
        <View style={styles.warungPanel}>
          <View style={styles.warungHead}>
            <Text variant="title" accessibilityRole="header">
              Tentang warungmu
            </Text>
            <Text variant="meta" color="secondary">
              Isi sekali sekarang, biar pembeli langsung ketemu warungmu.
            </Text>
          </View>

          <Field
            label="Nama warung"
            placeholder="Contoh: Warung Bu Rina"
            leftIcon="home"
            value={storeName}
            onChangeText={(t) => {
              setStoreName(t);
              clear('storeName');
            }}
            error={errors.storeName}
          />
          <Field
            label="Deskripsi singkat (opsional)"
            placeholder="Contoh: Sembako lengkap, buka 06.00–21.00"
            multiline
            value={storeDesc}
            onChangeText={setStoreDesc}
          />

          <View style={styles.locationGroup}>
            <Text variant="label" color="body">
              Lokasi warung
            </Text>
            <Button
              label={coords ? 'Lokasi tersimpan' : 'Gunakan lokasi saat ini'}
              icon={coords ? 'check' : 'map-pin'}
              variant="info"
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
              placeholder="Atau tempel link Google Maps"
              autoCapitalize="none"
              keyboardType="url"
              accessibilityLabel="Link Google Maps"
              value={gmapsUrl}
              onChangeText={(t) => {
                setGmapsUrl(t);
                clear('storeLocation');
              }}
              error={errors.storeLocation}
              hint={
                errors.storeLocation
                  ? undefined
                  : 'Tips: tekan tombol lokasi saat kamu sedang berada di warung, supaya pembeli menemukan alamat yang benar.'
              }
            />
          </View>
        </View>
      )}

      <Button
        label={role === 'seller' ? 'Daftar & buat warung' : 'Daftar'}
        onPress={handleRegister}
        loading={submitting}
        style={styles.submit}
      />

      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.linkWrap} accessibilityRole="link">
          <Text variant="meta" color="secondary" align="center">
            Sudah punya akun?{' '}
            <Text variant="meta" color="link">
              Masuk
            </Text>
          </Text>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // No top padding: the dome runs under the status bar and owns the inset.
  page: { paddingTop: 0, gap: spacing.md },
  // The intro block used to space the form off the toggle; it is gone, so
  // the first label carries that gap itself.
  firstLabel: { marginTop: spacing.lg },
  roles: { gap: spacing.sm },
  // Side by side. `alignItems: stretch` is the row default, so both cards
  // match the taller one's height without hardcoding it.
  rolesRow: { flexDirection: 'row' },
  role: {
    gap: spacing.xs,
    minHeight: layout.minTouch,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  roleColumn: { flex: 1 },
  // Icon left, check right. Reserves its own line so the card keeps a stable
  // height whether or not it is selected.
  roleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  roleSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  warungPanel: {
    gap: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.neutralBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    // The fill is a gentle step off the cream page, so a hairline crisps the
    // edge and stops the panel looking like a rendering artefact.
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
  warungHead: { gap: spacing.xs },
  locationGroup: { gap: spacing.sm },
  submit: { marginTop: spacing.sm },
  linkWrap: {
    alignSelf: 'center',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
