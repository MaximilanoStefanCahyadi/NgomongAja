import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  ListState,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  Tag,
  Text,
  type CardTone,
  type TextColor,
} from '@/components/ui';
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
import { PAYMENT_BADGE, PAYMENT_METHOD_LABEL } from '@/lib/status-ui';
import { colors, spacing } from '@/lib/theme';

// Full-width status banner (more descriptive than the list chips). It carries
// a tone, not raw hex — the Card and the Text both read from it.
const STATUS_BANNER: Record<OrderStatus, { label: string; tone: CardTone; ink: TextColor }> = {
  pending: { label: 'Menunggu konfirmasi', tone: 'warn', ink: 'warn' },
  accepted: { label: 'Sedang diproses', tone: 'success', ink: 'primaryInk' },
  ready: { label: 'Siap diambil / diantar', tone: 'success', ink: 'primaryInk' },
  completed: { label: 'Pesanan selesai', tone: 'success', ink: 'primaryInk' },
  rejected: { label: 'Pesanan ditolak', tone: 'danger', ink: 'danger' },
  cancelled: { label: 'Pesanan dibatalkan', tone: 'danger', ink: 'danger' },
};

const REJECT_PRESETS = ['Stok habis', 'Toko tutup'];

export default function SellerOrderDetail() {
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
    if (r.length < 5) {
      Alert.alert('NgomongAja', 'Alasan minimal 5 karakter ya.');
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
      <Screen centered>
        <ListState state="loading" message="Memuat pesanan…" />
      </Screen>
    );
  }

  const banner = STATUS_BANNER[order.status];
  const pay = order.payments[0];
  const payStatus = pay ? PAYMENT_BADGE[pay.status] : null;
  const orderAlive = ['pending', 'accepted', 'ready', 'completed'].includes(order.status);
  const showPaymentTools = !!pay && pay.status === 'pending' && orderAlive;
  const subtotal = order.total - order.delivery_fee;

  // The one forward-moving action for this status — it lives in the footer.
  const primaryAction =
    order.status === 'pending'
      ? { label: 'Terima', icon: 'check' as const, onPress: () => setStatus('accepted') }
      : order.status === 'accepted'
        ? { label: 'Siap', icon: 'package' as const, onPress: () => setStatus('ready') }
        : order.status === 'ready'
          ? { label: 'Selesai', icon: 'check-circle' as const, onPress: complete }
          : null;

  // The destructive counterpart, kept out of the footer so it can't be hit
  // by muscle memory.
  const killAction =
    order.status === 'pending'
      ? { label: 'Tolak', mode: 'reject' as const }
      : order.status === 'accepted'
        ? { label: 'Batalkan', mode: 'cancel' as const }
        : order.status === 'ready'
          ? { label: 'Batalkan (pembeli tidak datang)', mode: 'cancel' as const }
          : null;

  return (
    <Screen
      scroll
      keyboard
      contentContainerStyle={styles.content}
      footer={
        !reasonMode && primaryAction ? (
          <Button
            label={primaryAction.label}
            icon={primaryAction.icon}
            onPress={primaryAction.onPress}
            loading={busy}
          />
        ) : undefined
      }>
      <ScreenHeader title="Detail Pesanan" backLabel="Pesanan" />

      <Card tone={banner.tone}>
        <Text variant="bodyStrong" color={banner.ink} accessibilityLiveRegion="polite">
          {banner.label}
        </Text>
      </Card>

      {/* Buyer: name + phone, big — the seller often needs to call. */}
      <SectionLabel first>Pembeli</SectionLabel>
      <Card gap={spacing.xs}>
        <Text variant="title" color="text">
          {order.buyer?.full_name ?? 'Pembeli'}
        </Text>
        <Text variant="subtitle" color="body">
          {order.buyer?.phone ?? 'Nomor HP tidak ada'}
        </Text>
      </Card>

      <SectionLabel>Pengambilan</SectionLabel>
      {order.fulfillment === 'delivery' ? (
        <Card tone="success">
          <Row
            title="Diantar ke alamat"
            meta={order.delivery_address ?? 'Alamat tidak tersedia'}
            leading={<Feather name="truck" size={20} color={colors.successInk} />}
          />
        </Card>
      ) : (
        <Card>
          <Row
            title="Ambil sendiri di toko"
            meta="Pembeli datang ke toko"
            leading={<Feather name="home" size={20} color={colors.body} />}
          />
        </Card>
      )}

      <SectionLabel>Barang</SectionLabel>
      <Card>
        {items.map((it, idx) => (
          <Row
            key={idx}
            title={`${it.products?.name ?? 'Barang'} × ${it.quantity}`}
            value={formatRupiah(it.unit_price * it.quantity)}
          />
        ))}
        <Row title="Subtotal" value={formatRupiah(subtotal)} />
        {order.delivery_fee > 0 && (
          <Row title="Ongkir" value={formatRupiah(order.delivery_fee)} />
        )}
        <Row title="Total" value={formatRupiah(order.total)} emphasis="total" />
      </Card>

      <SectionLabel>Pembayaran</SectionLabel>
      <Card>
        <Row
          title={pay ? PAYMENT_METHOD_LABEL[pay.method] : '—'}
          trailing={payStatus ? <Tag label={payStatus.label} tone={payStatus.tone} /> : undefined}
        />
        {pay?.status === 'voided' && !!payStatus?.note && (
          <Text variant="meta" color="secondary">
            {payStatus.note}
          </Text>
        )}
        <Text variant="meta" color="secondary">
          DEMO — tidak ada uang berpindah
        </Text>
      </Card>

      {/* Reason panel (reject / cancel) */}
      {reasonMode && (
        <Card tone="danger" gap={spacing.md} style={styles.block}>
          <Text variant="bodyStrong" color="danger">
            {reasonMode === 'reject' ? 'Alasan menolak pesanan' : 'Alasan membatalkan pesanan'}
          </Text>
          {reasonMode === 'reject' && (
            <View style={styles.presetRow}>
              {REJECT_PRESETS.map((p) => (
                <Button
                  key={p}
                  label={p}
                  variant="quiet"
                  size="md"
                  fullWidth={false}
                  onPress={() => setReason(p)}
                />
              ))}
            </View>
          )}
          <Field
            multiline
            placeholder="Tulis alasan untuk pembeli…"
            value={reason}
            onChangeText={setReason}
            accessibilityLabel="Alasan untuk pembeli"
          />
          <Button
            label={reasonMode === 'reject' ? 'Tolak Pesanan' : 'Batalkan Pesanan'}
            variant="destructive"
            onPress={submitReason}
            loading={busy}
          />
          <Button
            label="Tidak jadi"
            variant="quiet"
            size="md"
            onPress={() => {
              setReasonMode(null);
              setReason('');
            }}
          />
        </Card>
      )}

      {/* Secondary actions per status */}
      {!reasonMode && (
        <View style={styles.actions}>
          {showPaymentTools && (
            <Button
              label="Minta Pembayaran"
              icon="dollar-sign"
              variant="secondary"
              size="md"
              onPress={requestPayment}
              disabled={busy}
            />
          )}
          {showPaymentTools && pay?.method === 'cash' && (
            <Button
              label="Tandai sudah dibayar"
              variant="quiet"
              size="md"
              onPress={markPaid}
              disabled={busy}
            />
          )}

          <Button
            label="Chat Pembeli"
            icon="message-circle"
            variant="secondary"
            size="md"
            onPress={() =>
              router.push({
                pathname: '/(seller)/order/[orderId]/chat',
                params: { orderId: order.id },
              })
            }
          />

          {killAction && (
            <Button
              label={killAction.label}
              variant="destructive"
              size="md"
              onPress={() => setReasonMode(killAction.mode)}
              disabled={busy}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  block: { marginTop: spacing.lg },
  presetRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
