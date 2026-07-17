import { Feather } from '@expo/vector-icons';
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
import { PAYMENT_BADGE, PAYMENT_METHOD_LABEL, STATUS_CHIP } from '@/lib/status-ui';
import { colors, fonts, radius, scrollWrap } from '@/lib/theme';

// The happy path as numbered steps (per the design). Rejected/cancelled
// get a red banner instead.
const TIMELINE: { key: 'pending' | 'accepted' | 'ready' | 'completed'; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Selesai' },
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
  const chip = STATUS_CHIP[order.status];
  const orderDate = new Date(order.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backWrap}
        accessibilityRole="button"
        accessibilityLabel="Kembali">
        <Feather name="chevron-left" size={18} color={colors.primaryDark} />
        <Text style={styles.back}>Pesanan Saya</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
          {order.stores?.name ?? 'Pesanan'}
        </Text>
        <Text style={[styles.chip, { backgroundColor: chip.bg, color: chip.fg }]}>
          {chip.label}
        </Text>
      </View>
      <Text style={styles.meta}>
        {orderDate} · No. {order.id.slice(0, 4).toUpperCase()}
      </Text>

      {isDead ? (
        <View style={styles.deadBanner}>
          <Text style={styles.deadBannerText}>
            {order.status === 'rejected'
              ? 'Pesanan ditolak penjual.'
              : 'Pesanan dibatalkan.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.stepSummary} accessibilityLiveRegion="polite">
            Langkah {currentStep + 1} dari {TIMELINE.length} — {TIMELINE[currentStep].label}
          </Text>
          <View style={styles.timeline}>
            {TIMELINE.map((step, i) => {
              const done = i < currentStep;
              const current = i === currentStep;
              return (
                <View key={step.key} style={styles.timelineStep}>
                  {i < TIMELINE.length - 1 && (
                    <View style={[styles.connector, done && styles.connectorDone]} />
                  )}
                  <View style={[styles.dotRing, current && styles.dotRingCurrent]}>
                    <View
                      style={[
                        styles.dot,
                        (done || current) && styles.dotActive,
                      ]}>
                      {done ? (
                        <Feather name="check" size={15} color={colors.onPrimary} />
                      ) : (
                        <Text
                          style={[
                            styles.dotNum,
                            (done || current) && styles.dotNumActive,
                          ]}>
                          {i + 1}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Barang</Text>
      <View style={styles.itemsCard}>
        {items.map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {it.products?.name ?? 'Produk'} × {String(it.quantity).replace('.', ',')}
            </Text>
            <Text style={styles.itemTotal}>
              {formatRupiah(Math.round(it.unit_price * it.quantity))}
            </Text>
          </View>
        ))}
        {order.delivery_fee > 0 && (
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>Ongkir</Text>
            <Text style={styles.itemTotal}>{formatRupiah(order.delivery_fee)}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.itemRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>{formatRupiah(order.total)}</Text>
        </View>
      </View>

      {order.fulfillment === 'delivery' && !!order.delivery_address && (
        <>
          <Text style={styles.sectionLabel}>Alamat pengantaran</Text>
          <Text style={styles.address}>{order.delivery_address}</Text>
        </>
      )}

      {payment && (
        <View style={styles.paymentRow}>
          <Text style={styles.paymentMethod}>{PAYMENT_METHOD_LABEL[payment.method]}</Text>
          <Text
            style={[
              styles.chip,
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
            style={({ pressed }) => [
              styles.primaryBtn,
              busy && styles.btnDisabled,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={payNow}
            disabled={busy}
            accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Bayar Sekarang (simulasi)</Text>
          </Pressable>
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.softBtn, pressed && { backgroundColor: colors.primaryChipBorder }]}
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/(buyer)/order/[orderId]/chat', params: { orderId } })
        }>
        <Feather name="message-circle" size={20} color={colors.primaryDeep} />
        <Text style={styles.softBtnText}>Chat Penjual</Text>
      </Pressable>

      {order.status === 'completed' && items && items.length > 0 && (
        // PA-5: rebuild a cart from this order and jump straight to checkout.
        <Pressable
          style={({ pressed }) => [styles.softBtn, pressed && { backgroundColor: colors.primaryChipBorder }]}
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
          <Feather name="rotate-ccw" size={19} color={colors.primaryDeep} />
          <Text style={styles.softBtnText}>Pesan Lagi</Text>
        </Pressable>
      )}

      {order.status === 'pending' && (
        <Pressable
          onPress={cancelOrder}
          disabled={busy}
          hitSlop={12}
          style={styles.ghostWrap}
          accessibilityRole="button">
          <Text style={styles.ghostDanger}>Batalkan Pesanan</Text>
        </Pressable>
      )}

      {order.status === 'completed' && reviewLoaded && (
        <>
          <Text style={styles.sectionLabel}>Ulasan</Text>
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
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (rating < 1 || busy) && styles.btnDisabled,
                  pressed && styles.primaryBtnPressed,
                ]}
                onPress={sendReview}
                disabled={rating < 1 || busy}
                accessibilityRole="button">
                <Text style={styles.primaryBtnText}>Kirim Ulasan</Text>
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
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  chip: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  deadBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 8,
  },
  deadBannerText: { fontFamily: fonts.bodySemi, color: colors.dangerDark, fontSize: 14.5 },
  stepSummary: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
    marginTop: 12,
  },
  timeline: { flexDirection: 'row', marginTop: 10, marginBottom: 6 },
  timelineStep: { flex: 1, alignItems: 'center' },
  connector: {
    position: 'absolute',
    top: 19,
    left: '50%',
    width: '100%',
    height: 3,
    backgroundColor: colors.neutralBg,
  },
  connectorDone: { backgroundColor: colors.primary },
  dotRing: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRingCurrent: { backgroundColor: colors.primaryChipBg },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotNum: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.secondary },
  dotNumActive: { color: colors.onPrimary },
  stepLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.secondary,
    marginTop: 6,
  },
  stepLabelCurrent: { fontFamily: fonts.bodyBold, color: colors.primaryDeep },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 16,
  },
  itemsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.text, flex: 1 },
  itemTotal: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.primaryDark },
  divider: { height: 1, backgroundColor: colors.border },
  totalLabel: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  address: { fontFamily: fonts.body, fontSize: 14, color: colors.body, lineHeight: 21 },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  paymentMethod: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text, flex: 1 },
  demoBanner: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.amberText,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 15,
    alignItems: 'center',
  },
  primaryBtnPressed: { backgroundColor: colors.primaryDark },
  btnDisabled: { backgroundColor: colors.disabled },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontFamily: fonts.heading },
  softBtn: {
    backgroundColor: colors.primaryChipBg,
    borderRadius: radius.pill,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  softBtnText: { color: colors.primaryDeep, fontSize: 16, fontFamily: fonts.heading },
  ghostWrap: { alignSelf: 'center', paddingVertical: 12 },
  ghostDanger: { fontFamily: fonts.bodySemi, color: colors.sunnyText, fontSize: 14 },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  reviewStars: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.amber },
  reviewComment: { fontFamily: fonts.body, fontSize: 14, color: colors.body, lineHeight: 20 },
  hintSmall: { fontFamily: fonts.body, fontSize: 13, color: colors.body },
  starRow: { flexDirection: 'row', gap: 4 },
  starTap: { padding: 6 },
  star: { fontSize: 34, color: colors.border },
  starActive: { color: colors.amber },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    fontFamily: fonts.body,
    minHeight: 60,
    backgroundColor: colors.bg,
    color: colors.text,
  },
});
