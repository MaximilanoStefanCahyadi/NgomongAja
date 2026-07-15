import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { countPendingForOwner, expireStaleOrders } from '@/lib/orders';
import { listMyStores, type Store } from '@/lib/stores';

export default function SellerHome() {
  const { profile, signOut } = useAuth();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // useFocusEffect re-runs every time this screen comes back into view,
  // so a store created on the next screen appears here without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      listMyStores(profile.id)
        .then(setStores)
        .catch((e) => console.warn('listMyStores:', e.message));
      // Global pending badge across ALL stores (PRD S-1) — a pending order at
      // the other warung must never rot invisibly.
      expireStaleOrders()
        .then(() => countPendingForOwner(profile.id))
        .then(setPendingCount)
        .catch(() => {});
    }, [profile])
  );

  if (!stores) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Toko Saya</Text>
      <Text style={styles.subtitle}>Halo, {profile?.full_name}</Text>
      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            🔔 {pendingCount} pesanan menunggu konfirmasi — buka tokonya lalu ke "📋 Pesanan"
          </Text>
        </View>
      )}

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Belum ada toko. Buat toko pertamamu dulu, lalu isi daftar barangnya.
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/(seller)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={[styles.badge, item.is_active ? styles.open : styles.closed]}>
                {item.is_active ? 'Buka' : 'Tutup'}
              </Text>
            </Pressable>
          </Link>
        )}
      />

      <Link href="/(seller)/store/new" asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Tambah Toko</Text>
        </Pressable>
      </Link>

      <Pressable onPress={signOut}>
        <Text style={styles.signOut}>Keluar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  pendingBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pendingBannerText: { color: '#92400e', fontSize: 13, fontWeight: '600' },
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
  badge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  open: { backgroundColor: '#dcfce7', color: '#15803d' },
  closed: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  addButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { textAlign: 'center', color: '#dc2626', marginTop: 16, fontSize: 14 },
});
