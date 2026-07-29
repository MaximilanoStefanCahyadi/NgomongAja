import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Card, ListState, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatRupiah } from '@/lib/format';
import { expireStaleOrders, listMyOrders, type OrderRow } from '@/lib/orders';
import { PAYMENT_BADGE, STATUS_CHIP } from '@/lib/status-ui';
import { spacing } from '@/lib/theme';

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
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    await expireStaleOrders();
    setOrders(await listMyOrders(profile.id));
  }, [profile]);

  const retry = useCallback(() => {
    setLoadFailed(false);
    setOrders(null);
    load().catch((e) => {
      console.warn('listMyOrders:', e.message);
      setLoadFailed(true);
      setOrders([]);
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => {
        console.warn('listMyOrders:', e.message);
        setLoadFailed(true);
        setOrders([]);
      });
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadFailed(false);
    await load().catch(() => setLoadFailed(true));
    setRefreshing(false);
  };

  if (!orders) {
    return (
      <Screen centered>
        <ListState state="loading" message="Memuat pesananmu…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Pesanan Saya" backLabel="Beranda" />

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loadFailed ? (
            <ListState
              state="error"
              title="Gagal memuat"
              message="Periksa koneksi internetmu, lalu coba lagi."
              action={{ label: 'Coba Lagi', onPress: retry }}
            />
          ) : (
            <ListState
              state="empty"
              icon="file-text"
              title="Belum ada pesanan"
              message="Pesananmu akan muncul di sini. Yuk pesan dari warung terdekat!"
              action={{ label: 'Cari Warung', onPress: () => router.back() }}
            />
          )
        }
        renderItem={({ item: o }) => {
          const chip = STATUS_CHIP[o.status];
          const payment = o.payments[0];
          const payBadge = payment ? PAYMENT_BADGE[payment.status] : null;
          return (
            <Card
              padding="sm"
              gap={spacing.xs}
              accessibilityLabel={`${o.stores?.name ?? 'Toko'}, ${chip.label}, ${formatRupiah(o.total)}`}
              onPress={() =>
                router.push({
                  pathname: '/(buyer)/order/[orderId]',
                  params: { orderId: o.id },
                })
              }>
              <Row
                title={o.stores?.name ?? 'Toko'}
                meta={formatDate(o.created_at)}
                trailing={<Tag label={chip.label} tone={chip.tone} />}
              />
              <View style={styles.footer}>
                <Text variant="money" color="text">
                  {formatRupiah(o.total)}
                </Text>
                {payBadge && <Tag label={payBadge.label} tone={payBadge.tone} />}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
