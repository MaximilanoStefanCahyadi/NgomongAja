import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatRupiah } from '@/lib/format';
import {
  expireStaleOrders,
  listStoreOrders,
  type OrderRow,
  type OrderStatus,
} from '@/lib/orders';

// Filter chips (PRD S-2). "Semua" shows everything, including rejected/cancelled.
type FilterKey = 'all' | 'pending' | 'accepted' | 'ready' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Selesai' },
];

const STATUS_CHIP: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Menunggu', bg: '#fef3c7', fg: '#92400e' },
  accepted: { label: 'Diproses', bg: '#dbeafe', fg: '#1e40af' },
  ready: { label: 'Siap', bg: '#ccfbf1', fg: '#115e59' },
  completed: { label: 'Selesai', bg: '#dcfce7', fg: '#15803d' },
  rejected: { label: 'Ditolak', bg: '#fee2e2', fg: '#b91c1c' },
  cancelled: { label: 'Dibatalkan', bg: '#fee2e2', fg: '#b91c1c' },
};

const PAYMENT_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Belum dibayar', bg: '#fef3c7', fg: '#92400e' },
  paid: { label: 'Lunas', bg: '#dcfce7', fg: '#15803d' },
  voided: { label: 'Dibatalkan', bg: '#f3f4f6', fg: '#6b7280' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function StoreOrders() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      (async () => {
        // Check-on-read expiry (AS-12) before showing the list.
        await expireStaleOrders();
        setOrders(await listStoreOrders(id));
      })().catch((e) => console.warn('listStoreOrders:', e.message));
    }, [id])
  );

  const visible = orders?.filter((o) => filter === 'all' || o.status === filter) ?? null;

  if (!visible) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Kembali</Text>
      </Pressable>
      <Text style={styles.title}>Pesanan Masuk</Text>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'all'
              ? 'Belum ada pesanan masuk.'
              : 'Tidak ada pesanan di kategori ini.'}
          </Text>
        }
        renderItem={({ item: o }) => {
          const status = STATUS_CHIP[o.status];
          const pay = o.payments[0] ? PAYMENT_BADGE[o.payments[0].status] : null;
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(seller)/order/[orderId]',
                  params: { orderId: o.id },
                })
              }>
              <View style={styles.cardTop}>
                <Text style={styles.buyerName} numberOfLines={1}>
                  {o.buyer?.full_name ?? 'Pembeli'}
                </Text>
                <Text style={styles.time}>{formatTime(o.created_at)}</Text>
              </View>
              <View style={styles.cardMid}>
                <Text style={styles.total}>{formatRupiah(o.total)}</Text>
                <Text style={styles.fulfillment}>
                  {o.fulfillment === 'delivery' ? '🛵 Diantar' : '🏪 Ambil sendiri'}
                </Text>
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
                </View>
                {pay && (
                  <View style={[styles.badge, { backgroundColor: pay.bg }]}>
                    <Text style={[styles.badgeText, { color: pay.fg }]}>{pay.label}</Text>
                  </View>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  empty: { color: '#666', textAlign: 'center', marginTop: 32, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buyerName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: '#888' },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 16, fontWeight: 'bold', color: '#15803d' },
  fulfillment: { fontSize: 13, color: '#555' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
