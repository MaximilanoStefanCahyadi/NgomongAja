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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { formatRupiah } from '@/lib/format';
import { expireStaleOrders, listMyOrders, type OrderRow } from '@/lib/orders';
import { PAYMENT_BADGE, STATUS_CHIP } from '@/lib/status-ui';
import { colors, fonts, radius, screenWrap, spacing } from '@/lib/theme';

// "2026-07-15T…" -> "15 Jul 2026"
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MyOrders() {
  const insets = useSafeAreaInsets();
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Beranda</Text>
      </Pressable>
      <Text style={styles.title}>Pesanan Saya</Text>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loadFailed ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>Gagal memuat. Periksa internetmu.</Text>
              <Pressable style={styles.emptyButton} onPress={retry} accessibilityRole="button">
                <Text style={styles.emptyButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                🧾 Belum ada pesanan. Yuk pesan dari warung terdekat!
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.back()}
                accessibilityRole="button">
                <Text style={styles.emptyButtonText}>Cari Warung</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item: o }) => {
          const chip = STATUS_CHIP[o.status];
          const payment = o.payments[0];
          const payBadge = payment ? PAYMENT_BADGE[payment.status] : null;
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
                  {chip.label}
                </Text>
              </View>
              <Text style={styles.date}>{formatDate(o.created_at)}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.total}>{formatRupiah(o.total)}</Text>
                {payBadge && (
                  <Text
                    style={[
                      styles.payBadge,
                      { backgroundColor: payBadge.bg, color: payBadge.fg },
                    ]}>
                    {payBadge.label}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { ...screenWrap },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 30, fontFamily: fonts.heading, color: colors.text },
  empty: { color: colors.body, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  emptyBox: { alignItems: 'center', gap: spacing.md },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  storeName: { fontSize: 16, fontFamily: fonts.bodySemi, flex: 1, color: colors.text },
  chip: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  date: { fontSize: 13, color: colors.body },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: { fontSize: 15, fontFamily: fonts.heading, color: colors.primaryDark },
  payBadge: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
