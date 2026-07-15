import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { formatRupiah } from '@/lib/format';
import {
  expireStaleOrders,
  listMyOrders,
  type OrderRow,
  type OrderStatus,
} from '@/lib/orders';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Menunggu',
  accepted: 'Diproses',
  ready: 'Siap',
  completed: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

// chip colors: pending amber, accepted blue, ready teal, completed green, rejected/cancelled red
const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  accepted: { bg: '#dbeafe', fg: '#1e40af' },
  ready: { bg: '#ccfbf1', fg: '#0f766e' },
  completed: { bg: '#dcfce7', fg: '#15803d' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c' },
  cancelled: { bg: '#fee2e2', fg: '#b91c1c' },
};

const PAYMENT_LABELS: Record<'pending' | 'paid' | 'voided', string> = {
  pending: 'Belum dibayar',
  paid: 'Lunas',
  voided: 'Dibatalkan',
};

// "2026-07-15T…" -> "15 Jul 2026"
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    await expireStaleOrders();
    setOrders(await listMyOrders(profile.id));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => {
        console.warn('listMyOrders:', e.message);
        setOrders([]);
      });
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (!orders) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Beranda</Text>
      </Pressable>
      <Text style={styles.title}>Pesanan Saya</Text>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Belum ada pesanan. Cari warung terdekat dan ngomong aja!
          </Text>
        }
        renderItem={({ item: o }) => {
          const chip = STATUS_COLORS[o.status];
          const payment = o.payments[0];
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(buyer)/order/[orderId]',
                  params: { orderId: o.id },
                })
              }>
              <View style={styles.cardHeader}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {o.stores?.name ?? 'Toko'}
                </Text>
                <Text style={[styles.chip, { backgroundColor: chip.bg, color: chip.fg }]}>
                  {STATUS_LABELS[o.status]}
                </Text>
              </View>
              <Text style={styles.date}>{formatDate(o.created_at)}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.total}>{formatRupiah(o.total)}</Text>
                {payment && (
                  <Text
                    style={[
                      styles.payBadge,
                      payment.status === 'paid' && styles.payBadgePaid,
                    ]}>
                    {PAYMENT_LABELS[payment.status]}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 64 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold' },
  empty: { color: '#666', textAlign: 'center', marginTop: 32, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  storeName: { fontSize: 16, fontWeight: '600', flex: 1 },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  date: { fontSize: 13, color: '#777' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 15, fontWeight: 'bold', color: '#15803d' },
  payBadge: {
    fontSize: 12,
    color: '#555',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  payBadgePaid: { color: '#15803d', backgroundColor: '#dcfce7', fontWeight: '600' },
});
