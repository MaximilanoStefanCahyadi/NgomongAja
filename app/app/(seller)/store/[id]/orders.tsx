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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRupiah } from '@/lib/format';
import { expireStaleOrders, listStoreOrders, type OrderRow } from '@/lib/orders';
import { PAYMENT_BADGE, STATUS_CHIP } from '@/lib/status-ui';
import { colors, radius, screenWrap } from '@/lib/theme';

// Filter chips (PRD S-2). "Semua" shows everything, including rejected/cancelled.
type FilterKey = 'all' | 'pending' | 'accepted' | 'ready' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Selesai' },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export default function StoreOrders() {
  const insets = useSafeAreaInsets();
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Toko</Text>
      </Pressable>
      <Text style={styles.title}>Pesanan Masuk 📋</Text>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}>
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
              accessibilityRole="button"
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { ...screenWrap },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, color: colors.text },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.body },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  empty: { color: colors.body, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buyerName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8, color: colors.text },
  time: { fontSize: 12, color: colors.secondary },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 16, fontWeight: 'bold', color: colors.primaryDark },
  fulfillment: { fontSize: 13, color: colors.body },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
