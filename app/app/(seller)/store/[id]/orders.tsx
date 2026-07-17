import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import {
  expireStaleOrders,
  listStoreOrders,
  updateOrderStatus,
  type OrderRow,
} from '@/lib/orders';
import { PAYMENT_BADGE, STATUS_CHIP } from '@/lib/status-ui';
import { colors, fonts, radius, screenWrap } from '@/lib/theme';

// Filter chips (PRD S-2). "Semua" shows everything, including rejected/cancelled.
type FilterKey = 'all' | 'pending' | 'accepted' | 'ready' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Baru' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Riwayat' },
];

function formatTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const d = new Date(iso);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function itemsSummary(o: OrderRow): string {
  return (o.order_items ?? [])
    .map(
      (it) =>
        `${it.products?.name ?? 'Barang'} × ${String(it.quantity).replace('.', ',')}`
    )
    .join(' · ');
}

export default function StoreOrders() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    // Check-on-read expiry (AS-12) before showing the list.
    await expireStaleOrders();
    setOrders(await listStoreOrders(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn('listStoreOrders:', e.message));
    }, [load])
  );

  // Inline accept straight from the card (per the design) — one tap while
  // standing at the counter. Reject needs a reason, so it opens the detail.
  const acceptInline = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, 'accepted');
      await load();
    } catch (e) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = orders?.filter((o) => o.status === 'pending').length ?? 0;
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
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backWrap}
        accessibilityRole="button"
        accessibilityLabel="Kembali">
        <Feather name="chevron-left" size={18} color={colors.primaryDark} />
        <Text style={styles.back}>Toko</Text>
      </Pressable>
      <Text style={styles.title}>Pesanan</Text>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.segScroll}
          contentContainerStyle={styles.seg}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.segOpt, filter === f.key && styles.segOptOn]}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}>
              <Text style={[styles.segText, filter === f.key && styles.segTextOn]}>
                {f.key === 'pending' && pendingCount > 0
                  ? `${f.label} (${pendingCount})`
                  : f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: 12, paddingVertical: 16 }}
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
          const summary = itemsSummary(o);
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
              {!!summary && (
                <Text style={styles.summary} numberOfLines={2}>
                  {summary}
                </Text>
              )}
              <View style={styles.cardMid}>
                <Text style={styles.total}>{formatRupiah(o.total)}</Text>
                <Text style={styles.fulfillTag}>
                  {o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil sendiri'}
                </Text>
              </View>
              {o.status === 'pending' ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.rejectBtn}
                    disabled={busyId === o.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/(seller)/order/[orderId]',
                        params: { orderId: o.id },
                      })
                    }>
                    <Text style={styles.rejectText}>Tolak</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.acceptBtn,
                      pressed && { backgroundColor: colors.primaryDark },
                    ]}
                    disabled={busyId === o.id}
                    accessibilityRole="button"
                    onPress={() => acceptInline(o.id)}>
                    {busyId === o.id ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.acceptText}>Terima Pesanan</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.badgeRow}>
                  <Text style={[styles.tag, { backgroundColor: status.bg, color: status.fg }]}>
                    {status.label}
                  </Text>
                  {pay && (
                    <Text style={[styles.tag, { backgroundColor: pay.bg, color: pay.fg }]}>
                      {pay.label}
                    </Text>
                  )}
                </View>
              )}
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
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, marginTop: 6 },
  segScroll: { flexGrow: 0, marginTop: 14 },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 3,
  },
  segOpt: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segOptOn: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.body },
  segTextOn: { color: colors.onPrimary },
  empty: {
    fontFamily: fonts.body,
    color: colors.body,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    gap: 10,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buyerName: {
    fontFamily: fonts.heading,
    fontSize: 18,
    flex: 1,
    marginRight: 8,
    color: colors.text,
  },
  time: { fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  summary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.body },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontFamily: fonts.heading, fontSize: 17, color: colors.primaryDark },
  fulfillTag: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.body,
    backgroundColor: colors.neutralBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.pill,
    padding: 11,
    alignItems: 'center',
  },
  rejectText: { fontFamily: fonts.heading, fontSize: 15, color: colors.body },
  acceptBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { fontFamily: fonts.heading, fontSize: 15, color: colors.onPrimary },
  badgeRow: { flexDirection: 'row', gap: 6 },
  tag: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
