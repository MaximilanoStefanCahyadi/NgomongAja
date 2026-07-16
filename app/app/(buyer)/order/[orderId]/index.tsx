import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import type { MatchResult } from '@/lib/matching';
import { setOrderDraft } from '@/lib/order-draft';
import {
  getOrder,
  listOrderItems,
  markPaidByBuyer,
  subscribeToOrder,
  updateOrderStatus,
  type OrderItemRow,
  type OrderRow,
} from '@/lib/orders';
import { getMyReview, submitReview } from '@/lib/reviews';
import { PAYMENT_BADGE, PAYMENT_METHOD_LABEL } from '@/lib/status-ui';
import { colors, radius, scrollWrap } from '@/lib/theme';

// The happy path, as a little journey with emoji milestones.
// Rejected/cancelled get a red banner instead.
const TIMELINE: {
  key: 'pending' | 'accepted' | 'ready' | 'completed';
  label: string;
  emoji: string;
}[] = [
  { key: 'pending', label: 'Menunggu', emoji: '🕐' },
  { key: 'accepted', label: 'Diproses', emoji: '👨‍🍳' },
  { key: 'ready', label: 'Siap', emoji: '📦' },
  { key: 'completed', label: 'Selesai', emoji: '🎉' },
];

type MyReview = { rating: number; comment: string | null } | null;

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [myReview, setMyReview] = useState<MyReview>(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    if (!orderId) return;
    const [o, its] = await Promise.all([getOrder(orderId), listOrderItems(orderId)]);
    setOrder(o);
    setItems(its);
    if (o.status === 'completed') {
      setMyReview(await getMyReview(orderId));
      setReviewLoaded(true);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    refetch().catch((e) => console.warn('getOrder:', e.message));
    // Live updates (PA-2): re-fetch whenever the order or its payment changes.
    const unsubscribe = subscribeToOrder(orderId, () => {
      refetch().catch(() => {});
    });
    return unsubscribe;
  }, [orderId, refetch]);

  if (!order || !orderId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const payment = order.payments[0];
  const isDead = order.status === 'rejected' || order.status === 'cancelled';
  const currentStep = TIMELINE.findIndex((s) => s.key === order.status);
  const itemsTotal = order.total - order.delivery_fee;

  const cancelOrder = () => {
    Alert.alert('Batalkan pesanan?', 'Pesanan ini akan dibatalkan dan tidak bisa dikembalikan.', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await updateOrderStatus(orderId, 'cancelled');
            await refetch();
          } catch (e) {
            Alert.alert('Gagal membatalkan', friendlyError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const payNow = async () => {
    setBusy(true);
    try {
      await markPaidByBuyer(orderId);
      await refetch();
    } catch (e) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendReview = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      await submitReview(orderId, rating, comment);
      setMyReview({ rating, comment: comment.trim() || null });
    } catch (e) {
      Alert.alert('Gagal mengirim ulasan', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Pesanan</Text>
      </Pressable>
      <Text style={styles.title}>{order.stores?.name ?? 'Pesanan'}</Text>

      {isDead ? (
        <View style={styles.deadBanner}>
          <Text style={styles.deadBannerText}>
            {order.status === 'rejected'
              ? '❌ Pesanan ditolak penjual.'
              : '❌ Pesanan dibatalkan.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.stepSummary} accessibilityLiveRegion="polite">
            Langkah {currentStep + 1} dari {TIMELINE.length} —{' '}
            {TIMELINE[currentStep].label} {TIMELINE[currentStep].emoji}
          </Text>
          <View style={styles.timeline}>
            {TIMELINE.map((step, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            const active = done || current;
            return (
              <View key={step.key} style={styles.timelineStep}>
                <View
                  style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                  <Text style={styles.dotEmoji}>{done ? '✓' : step.emoji}</Text>
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                  {step.label}
                </Text>
                {i < TIMELINE.length - 1 && (
                  <View style={[styles.connector, done && styles.connectorDone]} />
                )}
              </View>
            );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Barang</Text>
      <View style={styles.itemsCard}>
        {items.map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {it.products?.name ?? 'Produk'} × {String(it.quantity).replace('.', ',')}
            </Text>
            <View style={styles.itemPrices}>
              <Text style={styles.itemUnit}>@{formatRupiah(it.unit_price)}</Text>
              <Text style={styles.itemTotal}>
                {formatRupiah(Math.round(it.unit_price * it.quantity))}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {order.fulfillment === 'delivery' && !!order.delivery_address && (
        <>
          <Text style={styles.sectionTitle}>Alamat Pengantaran</Text>
          <Text style={styles.address}>📍 {order.delivery_address}</Text>
        </>
      )}

      <View style={styles.totals}>
        <Text style={styles.totalRow}>Barang: {formatRupiah(itemsTotal)}</Text>
        {order.delivery_fee > 0 && (
          <Text style={styles.totalRow}>Ongkir: {formatRupiah(order.delivery_fee)}</Text>
        )}
        <Text style={styles.grandTotal}>Total: {formatRupiah(order.total)}</Text>
      </View>

      {payment && (
        <View style={styles.paymentRow}>
          <Text style={styles.paymentMethod}>{PAYMENT_METHOD_LABEL[payment.method]}</Text>
          <Text
            style={[
              styles.payBadge,
              {
                color: PAYMENT_BADGE[payment.status].fg,
                backgroundColor: PAYMENT_BADGE[payment.status].bg,
              },
            ]}>
            {PAYMENT_BADGE[payment.status].label}
          </Text>
        </View>
      )}

      {payment && payment.status === 'pending' && payment.method !== 'cash' && !isDead && (
        <>
          <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={payNow}
            disabled={busy}
            accessibilityRole="button">
            <Text style={styles.buttonText}>Bayar Sekarang (coba-coba, uang tidak berpindah)</Text>
          </Pressable>
        </>
      )}

      {order.status === 'pending' && (
        <Pressable
          style={[styles.dangerButton, busy && styles.buttonDisabled]}
          onPress={cancelOrder}
          disabled={busy}
          accessibilityRole="button">
          <Text style={styles.dangerButtonText}>Batalkan Pesanan</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.chatButton}
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/(buyer)/order/[orderId]/chat', params: { orderId } })
        }>
        <Text style={styles.chatButtonText}>💬 Chat Penjual</Text>
      </Pressable>

      {order.status === 'completed' && items && items.length > 0 && (
        // PA-5: rebuild a cart from this order and jump straight to checkout.
        <Pressable
          style={styles.reorderButton}
          accessibilityRole="button"
          onPress={() => {
            const results: MatchResult[] = items.map((it) =>
              it.products && it.products.is_active
                ? {
                    kind: 'matched',
                    item: { name: it.products.name, quantity: Number(it.quantity), unit: 'pcs' },
                    product: it.products,
                  }
                : {
                    kind: 'unmatched',
                    item: {
                      name: it.products?.name ?? 'barang lama',
                      quantity: Number(it.quantity),
                      unit: 'pcs',
                    },
                  }
            );
            setOrderDraft({
              storeId: order.store_id,
              transcript: 'Pesan ulang dari riwayat pesanan',
              audioUri: null,
              results,
            });
            router.push({
              pathname: '/(buyer)/store/[id]/review',
              params: { id: order.store_id },
            });
          }}>
          <Text style={styles.reorderButtonText}>🔁 Pesan Lagi</Text>
        </Pressable>
      )}

      {order.status === 'completed' && reviewLoaded && (
        <>
          <Text style={styles.sectionTitle}>Ulasan</Text>
          {myReview ? (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewStars}>
                Ulasanmu: {'★'.repeat(myReview.rating)}
                {'☆'.repeat(5 - myReview.rating)}
              </Text>
              {!!myReview.comment && <Text style={styles.reviewComment}>{myReview.comment}</Text>}
            </View>
          ) : (
            <View style={styles.reviewCard}>
              <Text style={styles.hintSmall}>Bagaimana pesananmu? Beri bintang:</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    hitSlop={8}
                    style={styles.starTap}
                    accessibilityRole="button"
                    accessibilityLabel={`Beri ${n} bintang`}
                    accessibilityState={{ selected: n <= rating }}>
                    <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Tulis komentar (opsional)…"
                placeholderTextColor={colors.secondary}
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Pressable
                style={[styles.button, (rating < 1 || busy) && styles.buttonDisabled]}
                onPress={sendReview}
                disabled={rating < 1 || busy}
                accessibilityRole="button">
                <Text style={styles.buttonText}>Kirim Ulasan</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { ...scrollWrap, gap: 10 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.text },
  deadBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deadBannerText: { color: colors.dangerDark, fontWeight: '600', fontSize: 14 },
  reorderButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  reorderButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '600' },
  stepSummary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
    marginBottom: 2,
  },
  timeline: { flexDirection: 'row', marginVertical: 8 },
  timelineStep: { flex: 1, alignItems: 'center', position: 'relative' },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutralBg,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  dotDone: { backgroundColor: colors.primaryChipBg, borderColor: colors.primary },
  dotCurrent: {
    backgroundColor: colors.primaryBright,
    borderColor: colors.sunny,
    borderWidth: 3,
  },
  dotEmoji: { fontSize: 20 },
  stepLabel: { fontSize: 11, color: colors.secondary, marginTop: 4 },
  stepLabelActive: { color: colors.primaryDark, fontWeight: '700' },
  connector: {
    position: 'absolute',
    top: 23,
    left: '50%',
    width: '100%',
    height: 3,
    backgroundColor: colors.border,
  },
  connectorDone: { backgroundColor: colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10, color: colors.text },
  itemsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '500', flex: 1, color: colors.text },
  itemPrices: { alignItems: 'flex-end' },
  itemUnit: { fontSize: 12, color: colors.secondary },
  itemTotal: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  address: { fontSize: 14, color: colors.body, lineHeight: 20 },
  totals: { marginTop: 4, gap: 2 },
  totalRow: { fontSize: 14, color: colors.body, textAlign: 'right' },
  grandTotal: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', color: colors.text },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethod: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1 },
  payBadge: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontWeight: '600',
  },
  demoBanner: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberText,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  dangerButton: {
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: 13,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  dangerButtonText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  chatButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 13,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  chatButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  reviewStars: { fontSize: 16, color: colors.amber, fontWeight: '600' },
  reviewComment: { fontSize: 14, color: colors.body, lineHeight: 20 },
  hintSmall: { fontSize: 13, color: colors.body },
  starRow: { flexDirection: 'row', gap: 4 },
  starTap: { padding: 6 },
  star: { fontSize: 34, color: colors.border },
  starActive: { color: colors.amber },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
    backgroundColor: colors.card,
    color: colors.text,
  },
});
