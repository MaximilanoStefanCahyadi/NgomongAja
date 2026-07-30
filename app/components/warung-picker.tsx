// "Mau ngomong ke warung mana?"
//
// Voice ordering matches speech against ONE store's catalogue, so it cannot
// start without a store. The old home hero solved that by silently using the
// nearest warung — the buyer never saw which one they were ordering from.
// This asks instead. Saying it out loud is the whole brand: the app adapts to
// you, but it does not decide for you.

import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ListState, Row, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { listNearbyStores, type NearbyStore } from '@/lib/stores';
import { colors, radius, spacing } from '@/lib/theme';

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

export type WarungPickerProps = {
  visible: boolean;
  onClose: () => void;
};

export function WarungPicker({ visible, onClose }: WarungPickerProps) {
  const insets = useSafeAreaInsets();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;

    (async () => {
      setStores(null);
      setError(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (alive) setError('Izin lokasi belum aktif, jadi kami belum tahu warung terdekat.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const nearby = await listNearbyStores(pos.coords.latitude, pos.coords.longitude);
        if (alive) setStores(nearby);
      } catch (e) {
        if (alive) setError(friendlyError(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible]);

  const pick = (store: NearbyStore) => {
    onClose();
    router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: store.id } });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Tutup" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text variant="title" accessibilityRole="header">
              Mau ngomong ke warung mana?
            </Text>
            <Text variant="meta" color="secondary">
              Pilih dulu, habis itu tinggal sebutin belanjaannya.
            </Text>
          </View>
          <IconButton icon="x" accessibilityLabel="Tutup" onPress={onClose} />
        </View>

        {error ? (
          <ListState state="error" message={error} />
        ) : !stores ? (
          <ListState state="loading" message="Mencari warung di sekitarmu…" />
        ) : stores.length === 0 ? (
          <ListState
            state="empty"
            icon="map-pin"
            title="Belum ada warung di dekatmu"
            message="Coba lagi nanti, atau cari warung lewat tab Cari."
          />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            style={styles.list}
            renderItem={({ item }) => (
              <Row
                title={item.name}
                meta={formatDistance(item.distance_km)}
                onPress={() => pick(item)}
                leading={
                  <View style={styles.pin}>
                    <Feather name="shopping-bag" size={18} color={colors.primaryInk} />
                  </View>
                }
                trailing={<Feather name="mic" size={20} color={colors.primaryInk} />}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(16,35,61,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    maxHeight: '70%',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, gap: spacing.xs },
  list: { flexGrow: 0 },
  pin: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
