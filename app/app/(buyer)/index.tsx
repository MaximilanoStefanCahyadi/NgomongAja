import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { listNearbyStores, type NearbyStore } from '@/lib/stores';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

export default function BuyerHome() {
  const { profile, signOut } = useAuth();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNearby = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setDenied(true);
      setStores([]);
      return;
    }
    setDenied(false);
    const pos = await Location.getCurrentPositionAsync({});
    const nearby = await listNearbyStores(pos.coords.latitude, pos.coords.longitude);
    setStores(nearby);
  }, []);

  useEffect(() => {
    loadNearby().catch((e) => {
      console.warn('loadNearby:', e.message);
      setStores([]);
    });
  }, [loadNearby]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNearby().catch(() => {});
    setRefreshing(false);
  };

  if (!stores) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.centerText}>Mencari warung di sekitarmu…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Toko Terdekat</Text>
          <Text style={styles.subtitle}>Halo, {profile?.full_name}</Text>
        </View>
        <Link href="/(buyer)/orders" asChild>
          <Pressable style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>📋{'\n'}Pesanan</Text>
          </Pressable>
        </Link>
        <Link href="/(buyer)/profile" asChild>
          <Pressable style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>👤{'\n'}Profil</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {denied
              ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan supaya kami bisa mencari warung di dekatmu, lalu tarik layar ke bawah.'
              : 'Belum ada warung dalam radius 5 km. Tarik layar ke bawah untuk mencari lagi.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/(buyer)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={styles.distance}>{formatDistance(item.distance_km)}</Text>
            </Pressable>
          </Link>
        )}
      />

      <Pressable onPress={signOut}>
        <Text style={styles.signOut}>Keluar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  centerText: { color: '#666' },
  container: { flex: 1, padding: 24, paddingTop: 64 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerBtnText: { fontSize: 12, color: '#15803d', textAlign: 'center', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 32, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 13, color: '#777', marginTop: 2 },
  distance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  signOut: { textAlign: 'center', color: '#dc2626', marginTop: 16, fontSize: 14 },
});
