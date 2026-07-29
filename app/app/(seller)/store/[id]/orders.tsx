import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ListState,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Tag,
  Text,
} from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import {
  expireStaleOrders,
  listStoreOrders,
  updateOrderStatus,
  type OrderRow,
} from '@/lib/orders';
import { PAYMENT_BADGE, STATUS_CHIP } from '@/lib/status-ui';
import { spacing } from '@/lib/theme';

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

  const openOrder = (orderId: string) =>
    router.push({ pathname: '/(seller)/order/[orderId]', params: { orderId } });

  const pendingCount = orders?.filter((o) => o.status === 'pending').length ?? 0;
  const visible = orders?.filter((o) => filter === 'all' || o.status === filter) ?? null;

  if (!visible) {
    return (
      <Screen centered>
        <ListState state="loading" message="Memuat pesanan…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Pesanan" backLabel="Toko" />

      <View style={styles.filters}>
        <SegmentedControl<FilterKey>
          options={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            badge: f.key === 'pending' && pendingCount > 0 ? pendingCount : undefined,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ListState
            state="empty"
            icon="clipboard"
            message={
              filter === 'all'
                ? 'Belum ada pesanan masuk.'
                : 'Tidak ada pesanan di kategori ini.'
            }
          />
        }
        renderItem={({ item: o }) => {
          const status = STATUS_CHIP[o.status];
          const pay = o.payments[0] ? PAYMENT_BADGE[o.payments[0].status] : null;
          const summary = itemsSummary(o);
          return (
            <Card
              gap={spacing.sm}
              onPress={() => openOrder(o.id)}
              accessibilityLabel={`Pesanan ${o.buyer?.full_name ?? 'Pembeli'}, ${formatRupiah(
                o.total
              )}, ${status.label}`}>
              <View style={styles.cardTop}>
                <Text variant="subtitle" numberOfLines={1} style={styles.flex}>
                  {o.buyer?.full_name ?? 'Pembeli'}
                </Text>
                <Text variant="meta" color="secondary">
                  {formatTime(o.created_at)}
                </Text>
              </View>

              {!!summary && (
                <Text variant="body" color="body" numberOfLines={2}>
                  {summary}
                </Text>
              )}

              <View style={styles.cardMid}>
                <Text variant="money">{formatRupiah(o.total)}</Text>
                <Tag label={o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil sendiri'} />
              </View>

              {o.status === 'pending' ? (
                // Equal widths: the destructive option must not be harder to
                // hit than the confirming one.
                <View style={styles.actionRow}>
                  <Button
                    label="Tolak"
                    variant="quiet"
                    size="md"
                    style={styles.action}
                    disabled={busyId === o.id}
                    accessibilityHint="Buka detail pesanan untuk memilih alasan"
                    onPress={() => openOrder(o.id)}
                  />
                  <Button
                    label="Terima Pesanan"
                    size="md"
                    style={styles.action}
                    loading={busyId === o.id}
                    onPress={() => acceptInline(o.id)}
                  />
                </View>
              ) : (
                <View style={styles.badgeRow}>
                  <Tag label={status.label} tone={status.tone} />
                  {pay && <Tag label={pay.label} tone={pay.tone} />}
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

// Screen-specific layout only — every control above comes from the kit.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { marginTop: spacing.lg },
  list: { gap: spacing.md, paddingVertical: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardMid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  action: { flex: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
});
