import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { useAuth } from '@/lib/auth-context';
import { postSystemMessage, sendPaymentRequest } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import {
  getOrder,
  listOrderItems,
  markPaidByBuyer,
  updateOrderStatus,
  type OrderItemRow,
  type OrderRow,
  type OrderStatus,
} from '@/lib/orders';
import { PAYMENT_METHOD_LABEL } from '@/lib/status-ui';
import { colors, fonts, radius, scrollWrap } from '@/lib/theme';

// Full-width status banner (more descriptive than the list chips).
const STATUS_BANNER: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Menunggu konfirmasi', bg: colors.amberBg, fg: colors.amberText },
  accepted: { label: 'Sedang diproses', bg: colors.infoBg, fg: colors.info },
  ready: { label: 'Siap diambil / diantar', bg: colors.tealBg, fg: colors.teal },
  completed: { label: 'Pesanan selesai', bg: colors.primaryChipBg, fg: colors.primaryDark },
  rejected: { label: 'Pesanan ditolak', bg: colors.dangerBg, fg: colors.dangerDark },
  cancelled: { label: 'Pesanan dibatalkan', bg: colors.dangerBg, fg: colors.dangerDark },
};

const PAYMENT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Belum dibayar', color: colors.amberText },
  paid: { label: 'Lunas', color: colors.primaryDark },
  voided: { label: 'Tidak perlu dibayar', color: colors.secondary },
};

const REJECT_PRESETS = ['Stok habis', 'Toko tutup'];

export default function SellerOrderDetail() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { profile } = useAuth();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The reason panel serves both "reject" (pending) and "cancel" (accepted/ready).
  const [reasonMode, setReasonMode] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    const [o, it] = await Promise.all([getOrder(orderId), listOrderItems(orderId)]);
    setOrder(o);
    setItems(it);
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn('load order:', e.message));
    }, [load])
  );

  const setStatus = async (status: OrderStatus) => {
    if (!orderId) return;
    setBusy(true);
    try {
      await updateOrderStatus(orderId, status);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // Reject/cancel need a reason — the buyer reads it as a system chat message.
  const submitReason = async () => {
    if (!orderId || !profile || !reasonMode) return;
    const r = reason.trim();
    if (!r) {
      Alert.alert('NgomongAja', 'Tulis alasannya dulu ya, biar pembeli tahu.');
      return;
    }
    setBusy(true);
    try {
      if (reasonMode === 'reject') {
        await updateOrderStatus(orderId, 'rejected');
        await postSystemMessage(orderId, profile.id, `Pesanan ditolak: ${r}`);
      } else {
        await updateOrderStatus(orderId, 'cancelled');
        await postSystemMessage(orderId, profile.id, `Pesanan dibatalkan penjual: ${r}`);
      }
      setReasonMode(null);
      setReason('');
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const finishOrder = async (markPaidFirst: boolean) => {
    if (!orderId) return;
    setBusy(true);
    try {
      if (markPaidFirst) await markPaidByBuyer(orderId);
      await updateOrderStatus(orderId, 'completed');
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // "Selesai" on a cash order that is still unpaid: ask about the money first,
  // so the recap stays honest (paid vs unpaid).
  const complete = () => {
    const pay = order?.payments[0];
    if (pay?.method === 'cash' && pay.status === 'pending') {
      Alert.alert('Sudah dibayar?', 'Pesanan tunai ini belum ditandai lunas.', [
        { text: 'Sudah, tandai lunas', onPress: () => finishOrder(true) },
        { text: 'Belum dibayar', onPress: () => finishOrder(false) },
      ]);
    } else {
      finishOrder(false);
    }
  };

  const requestPayment = async () => {
    if (!orderId || !profile || !order) return;
    setBusy(true);
    try {
      await sendPaymentRequest(orderId, profile.id, formatRupiah(order.total));
      Alert.alert('NgomongAja', 'Permintaan terkirim ke chat');
    } catch (e: any) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      await markPaidByBuyer(orderId);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!order || !items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const banner = STATUS_BANNER[order.status];
  const pay = order.payments[0];
  const payStatus = pay ? PAYMENT_STATUS_LABEL[pay.status] : null;
  const orderAlive = ['pending', 'accepted', 'ready', 'completed'].includes(order.status);
  const showPaymentTools = !!pay && pay.status === 'pending' && orderAlive;
  const subtotal = order.total - order.delivery_fee;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Pesanan</Text>
      </Pressable>
      <Text style={styles.title}>Detail Pesanan</Text>

      <View style={[styles.banner, { backgroundColor: banner.bg }]}>
        <Text style={[styles.bannerText, { color: banner.fg }]}>{banner.label}</Text>
      </View>

      {/* Buyer: name + phone, big — the seller often needs to call. */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Pembeli</Text>
        <Text style={styles.buyerName}>{order.buyer?.full_name ?? 'Pembeli'}</Text>
        <Text style={styles.buyerPhone}>{order.buyer?.phone ?? 'Nomor HP tidak ada'}</Text>
      </View>

      {order.fulfillment === 'delivery' && (
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>🛵 Diantar ke alamat</Text>
          <Text style={styles.addressText}>
            {order.delivery_address ?? 'Alamat tidak tersedia'}
          </Text>
        </View>
      )}
      {order.fulfillment === 'pickup' && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pengambilan</Text>
          <Text style={styles.cardValue}>🏪 Ambil sendiri di toko</Text>
        </View>
      )}

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Barang</Text>
        {items.map((it, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {it.products?.name ?? 'Barang'} × {it.quantity}
            </Text>
            <Text style={styles.itemPrice}>{formatRupiah(it.unit_price * it.quantity)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.itemRow}>
          <Text style={styles.itemName}>Subtotal</Text>
          <Text style={styles.itemPrice}>{formatRupiah(subtotal)}</Text>
        </View>
        {order.delivery_fee > 0 && (
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>Ongkir</Text>
            <Text style={styles.itemPrice}>{formatRupiah(order.delivery_fee)}</Text>
          </View>
        )}
        <View style={styles.itemRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatRupiah(order.total)}</Text>
        </View>
      </View>

      {/* Payment */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Pembayaran</Text>
        <View style={styles.itemRow}>
          <Text style={styles.cardValue}>{pay ? PAYMENT_METHOD_LABEL[pay.method] : '—'}</Text>
          {payStatus && (
            <Text style={[styles.payStatus, { color: payStatus.color }]}>{payStatus.label}</Text>
          )}
        </View>
        <Text style={styles.demoNote}>DEMO — tidak ada uang berpindah</Text>
      </View>

      {/* Reason panel (reject / cancel) */}
      {reasonMode && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>
            {reasonMode === 'reject' ? 'Alasan menolak pesanan' : 'Alasan membatalkan pesanan'}
          </Text>
          {reasonMode === 'reject' && (
            <View style={styles.presetRow}>
              {REJECT_PRESETS.map((p) => (
                <Pressable key={p} style={styles.presetChip} onPress={() => setReason(p)}>
                  <Text style={styles.presetChipText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            style={styles.reasonInput}
            placeholder="Tulis alasan untuk pembeli…"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Pressable style={styles.dangerButton} onPress={submitReason} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.dangerButtonText}>
                {reasonMode === 'reject' ? 'Tolak Pesanan' : 'Batalkan Pesanan'}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setReasonMode(null);
              setReason('');
            }}>
            <Text style={styles.cancelLink}>Tidak jadi</Text>
          </Pressable>
        </View>
      )}

      {/* Actions per status */}
      {!reasonMode && (
        <View style={styles.actions}>
          {order.status === 'pending' && (
            <>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setStatus('accepted')}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>✅ Terima</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.dangerOutlineButton}
                onPress={() => setReasonMode('reject')}
                disabled={busy}>
                <Text style={styles.dangerOutlineText}>❌ Tolak</Text>
              </Pressable>
            </>
          )}

          {order.status === 'accepted' && (
            <>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setStatus('ready')}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>📦 Siap</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.dangerOutlineButton}
                onPress={() => setReasonMode('cancel')}
                disabled={busy}>
                <Text style={styles.dangerOutlineText}>Batalkan</Text>
              </Pressable>
            </>
          )}

          {order.status === 'ready' && (
            <>
              <Pressable style={styles.primaryButton} onPress={complete} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>🤝 Selesai</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.dangerOutlineButton}
                onPress={() => setReasonMode('cancel')}
                disabled={busy}>
                <Text style={styles.dangerOutlineText}>Batalkan (pembeli tidak datang)</Text>
              </Pressable>
            </>
          )}

          {showPaymentTools && (
            <>
              <Pressable style={styles.amberButton} onPress={requestPayment} disabled={busy}>
                <Text style={styles.amberButtonText}>💰 Minta Pembayaran</Text>
              </Pressable>
              {pay?.method === 'cash' && (
                <Pressable style={styles.outlineButton} onPress={markPaid} disabled={busy}>
                  <Text style={styles.outlineButtonText}>Tandai sudah dibayar</Text>
                </Pressable>
              )}
            </>
          )}

          <Pressable
            style={styles.outlineButton}
            onPress={() =>
              router.push({
                pathname: '/(seller)/order/[orderId]/chat',
                params: { orderId: order.id },
              })
            }>
            <Text style={styles.outlineButtonText}>💬 Chat Pembeli</Text>
          </Pressable>
        </View>
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
  container: { ...scrollWrap, gap: 12 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontFamily: fonts.bodySemi },
  title: { fontSize: 24, fontFamily: fonts.heading, color: colors.text },
  banner: { borderRadius: radius.md, padding: 12, alignItems: 'center' },
  bannerText: { fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardLabel: { fontSize: 12, color: colors.secondary, textTransform: 'uppercase', fontFamily: fonts.bodySemi },
  cardValue: { fontSize: 15, color: colors.text },
  demoNote: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.amberText,
    backgroundColor: colors.amberBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 4,
  },
  buyerName: { fontSize: 18, fontWeight: '700' },
  buyerPhone: { fontSize: 20, fontFamily: fonts.heading, color: colors.primaryDark },
  addressBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: radius.pill,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 4,
  },
  addressLabel: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.primaryDark },
  addressText: { fontSize: 16, color: colors.primaryDeep, lineHeight: 22 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, color: '#333', flex: 1, marginRight: 8 },
  itemPrice: { fontSize: 15, color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 16, fontFamily: fonts.heading, color: colors.primaryDark },
  payStatus: { fontSize: 14, fontWeight: '700' },
  actions: { gap: 10, marginTop: 4 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontFamily: fonts.bodySemi },
  dangerOutlineButton: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  dangerOutlineText: { color: '#dc2626', fontSize: 15, fontFamily: fonts.bodySemi },
  amberButton: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  amberButtonText: { color: '#92400e', fontSize: 15, fontFamily: fonts.bodySemi },
  outlineButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineButtonText: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  reasonBox: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    padding: 14,
    borderWidth: 2,
    borderColor: '#dc2626',
    gap: 10,
  },
  reasonTitle: { fontSize: 15, fontFamily: fonts.bodyBold, color: '#b91c1c' },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetChip: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: { color: '#b91c1c', fontSize: 13, fontFamily: fonts.bodySemi },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: radius.pill,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
    borderRadius: radius.pill,
    padding: 14,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#fff', fontSize: 15, fontFamily: fonts.bodySemi },
  cancelLink: { textAlign: 'center', color: '#666', fontSize: 14 },
});
