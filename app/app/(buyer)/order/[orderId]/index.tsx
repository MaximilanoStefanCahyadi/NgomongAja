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

import { formatRupiah } from '@/lib/format';
import {
  getOrder,
  listOrderItems,
  markPaidByBuyer,
  subscribeToOrder,
  updateOrderStatus,
  type OrderItemRow,
  type OrderRow,
  type PaymentMethod,
} from '@/lib/orders';
import { getMyReview, submitReview } from '@/lib/reviews';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'COD — bayar di tempat',
  gopay: 'GoPay',
  transfer: 'Transfer Bank',
};

const PAYMENT_LABELS: Record<'pending' | 'paid' | 'voided', string> = {
  pending: 'Belum dibayar',
  paid: 'Lunas',
  voided: 'Dibatalkan',
};

// The happy path, in order. Rejected/cancelled get a red banner instead.
const TIMELINE: { key: 'pending' | 'accepted' | 'ready' | 'completed'; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Selesai' },
];

type MyReview = { rating: number; comment: string | null } | null;

export default function OrderDetail() {
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
        <ActivityIndicator size="large" />
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
          } catch (e: any) {
            Alert.alert('Gagal membatalkan', e.message);
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
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
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
    } catch (e: any) {
      Alert.alert('Gagal mengirim ulasan', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Kembali</Text>
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
        <View style={styles.timeline}>
          {TIMELINE.map((step, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            return (
              <View key={step.key} style={styles.timelineStep}>
                <View
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    current && styles.dotCurrent,
                  ]}>
                  <Text style={[styles.dotText, (done || current) && styles.dotTextActive]}>
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]}>
                  {step.label}
                </Text>
                {i < TIMELINE.length - 1 && (
                  <View style={[styles.connector, done && styles.connectorDone]} />
                )}
              </View>
            );
          })}
        </View>
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
          <Text style={styles.paymentMethod}>{METHOD_LABELS[payment.method]}</Text>
          <Text
            style={[
              styles.payBadge,
              payment.status === 'paid' && styles.payBadgePaid,
              payment.status === 'voided' && styles.payBadgeVoided,
            ]}>
            {PAYMENT_LABELS[payment.status]}
          </Text>
        </View>
      )}

      {payment && payment.status === 'pending' && payment.method !== 'cash' && !isDead && (
        <>
          <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
          <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={payNow} disabled={busy}>
            <Text style={styles.buttonText}>Bayar Sekarang (SIMULASI)</Text>
          </Pressable>
        </>
      )}

      {order.status === 'pending' && (
        <Pressable
          style={[styles.dangerButton, busy && styles.buttonDisabled]}
          onPress={cancelOrder}
          disabled={busy}>
          <Text style={styles.dangerButtonText}>Batalkan Pesanan</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.chatButton}
        onPress={() =>
          router.push({ pathname: '/(buyer)/order/[orderId]/chat', params: { orderId } })
        }>
        <Text style={styles.chatButtonText}>💬 Chat Penjual</Text>
      </Pressable>

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
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Tulis komentar (opsional)…"
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Pressable
                style={[styles.button, (rating < 1 || busy) && styles.buttonDisabled]}
                onPress={sendReview}
                disabled={rating < 1 || busy}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 10 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 'bold' },
  deadBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deadBannerText: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
  timeline: { flexDirection: 'row', marginVertical: 8 },
  timelineStep: { flex: 1, alignItems: 'center', position: 'relative' },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  dotDone: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  dotCurrent: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  dotText: { fontSize: 13, fontWeight: '700', color: '#999' },
  dotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: '#777', marginTop: 4 },
  stepLabelCurrent: { color: '#15803d', fontWeight: '700' },
  connector: {
    position: 'absolute',
    top: 14,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#ddd',
  },
  connectorDone: { backgroundColor: '#16a34a' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10 },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 10,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '500', flex: 1 },
  itemPrices: { alignItems: 'flex-end' },
  itemUnit: { fontSize: 12, color: '#777' },
  itemTotal: { fontSize: 14, fontWeight: '600', color: '#15803d' },
  address: { fontSize: 14, color: '#444', lineHeight: 20 },
  totals: { marginTop: 4, gap: 2 },
  totalRow: { fontSize: 14, color: '#555', textAlign: 'right' },
  grandTotal: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  paymentMethod: { fontSize: 14, fontWeight: '500' },
  payBadge: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '600',
  },
  payBadgePaid: { color: '#15803d', backgroundColor: '#dcfce7' },
  payBadgeVoided: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  demoBanner: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#a7cbb4' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dangerButton: {
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dangerButtonText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
  chatButton: {
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  chatButtonText: { color: '#15803d', fontSize: 15, fontWeight: '600' },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 10,
  },
  reviewStars: { fontSize: 16, color: '#f59e0b', fontWeight: '600' },
  reviewComment: { fontSize: 14, color: '#444', lineHeight: 20 },
  hintSmall: { fontSize: 13, color: '#666' },
  starRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: '#ddd' },
  starActive: { color: '#f59e0b' },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
    backgroundColor: '#fff',
  },
});
