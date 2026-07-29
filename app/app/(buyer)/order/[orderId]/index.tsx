import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

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
} from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
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
import { colors, layout, radius, spacing } from '@/lib/theme';

// The happy path as numbered steps (per the design). Rejected/cancelled
// get a red banner instead.
const TIMELINE: { key: 'pending' | 'accepted' | 'ready' | 'completed'; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'accepted', label: 'Diproses' },
  { key: 'ready', label: 'Siap' },
  { key: 'completed', label: 'Selesai' },
];

const STARS = [1, 2, 3, 4, 5];

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
      <Screen centered>
        <ListState state="loading" message="Memuat pesanan…" />
      </Screen>
    );
  }

  const payment = order.payments[0];
  const isDead = order.status === 'rejected' || order.status === 'cancelled';
  const currentStep = TIMELINE.findIndex((s) => s.key === order.status);
  const chip = STATUS_CHIP[order.status];
  const orderDate = new Date(order.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const canPayNow =
    !!payment && payment.status === 'pending' && payment.method !== 'cash' && !isDead;

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

  const openChat = () =>
    router.push({ pathname: '/(buyer)/order/[orderId]/chat', params: { orderId } });

  return (
    <Screen
      scroll
      keyboard
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {canPayNow && (
            <Button
              label="Bayar Sekarang (simulasi)"
              icon="credit-card"
              onPress={payNow}
              loading={busy}
            />
          )}
          <Button
            label="Chat Penjual"
            icon="message-circle"
            variant="secondary"
            size={canPayNow ? 'md' : 'lg'}
            onPress={openChat}
          />
        </View>
      }>
      <ScreenHeader
        title={order.stores?.name ?? 'Pesanan'}
        backLabel="Pesanan Saya"
        subtitle={`${orderDate} · No. ${order.id.slice(0, 4).toUpperCase()}`}
        right={<Tag label={chip.label} tone={chip.tone} />}
      />

      {isDead ? (
        <Card tone="danger">
          <Text variant="bodyStrong" color="danger" accessibilityLiveRegion="polite">
            {order.status === 'rejected' ? 'Pesanan ditolak penjual.' : 'Pesanan dibatalkan.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.progress}>
          {/* The live region IS the accessible timeline — it announces the
              state as a sentence, so the dots below stay hidden from the
              screen reader rather than being read out as "1 2 3 4". */}
          <Text variant="bodyStrong" color="text" accessibilityLiveRegion="polite">
            Langkah {currentStep + 1} dari {TIMELINE.length} — {TIMELINE[currentStep].label}
          </Text>

          <View
            style={styles.timeline}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {TIMELINE.map((step, i) => {
              const done = i < currentStep;
              const current = i === currentStep;
              return (
                <View key={step.key} style={styles.step}>
                  {i < TIMELINE.length - 1 && (
                    <View style={[styles.connector, done && styles.connectorDone]} />
                  )}
                  {/* ONE dot, three states: done / current / future. */}
                  <View
                    style={[
                      styles.dot,
                      (done || current) && styles.dotOn,
                      current && styles.dotCurrent,
                    ]}>
                    {done ? (
                      <Feather name="check" size={16} color={colors.onPrimary} />
                    ) : (
                      <Text variant="label" color={current ? 'onPrimary' : 'secondary'}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    variant="tag"
                    color={current ? 'primaryInk' : 'secondary'}
                    align="center">
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <SectionLabel first>Barang</SectionLabel>
      <Card>
        {items.map((it, i) => (
          <Row
            key={i}
            title={`${it.products?.name ?? 'Produk'} × ${String(it.quantity).replace('.', ',')}`}
            value={formatRupiah(Math.round(it.unit_price * it.quantity))}
          />
        ))}
        {order.delivery_fee > 0 && (
          <Row title="Ongkir" value={formatRupiah(order.delivery_fee)} />
        )}
        <Row title="Total" value={formatRupiah(order.total)} emphasis="total" />
      </Card>

      {(payment || (order.fulfillment === 'delivery' && !!order.delivery_address)) && (
        <>
          <SectionLabel>Pengantaran &amp; pembayaran</SectionLabel>
          <Card>
            {order.fulfillment === 'delivery' && !!order.delivery_address && (
              <Row title="Diantar ke" meta={order.delivery_address} />
            )}
            {payment && (
              <Row
                title={PAYMENT_METHOD_LABEL[payment.method]}
                trailing={
                  <Tag
                    label={PAYMENT_BADGE[payment.status].label}
                    tone={PAYMENT_BADGE[payment.status].tone}
                  />
                }
              />
            )}
            {payment?.status === 'voided' && !!PAYMENT_BADGE.voided.note && (
              <Text variant="meta" color="secondary">
                {PAYMENT_BADGE.voided.note}
              </Text>
            )}
            {payment && (
              <Text variant="meta" color="secondary">
                DEMO — tidak ada uang berpindah
              </Text>
            )}
          </Card>
        </>
      )}

      {order.status === 'pending' && (
        // Cancelling is destructive, not a warning — it now looks like it.
        <Button
          label="Batalkan Pesanan"
          variant="destructive"
          size="md"
          onPress={cancelOrder}
          disabled={busy}
          style={styles.cancel}
        />
      )}

      {order.status === 'completed' && reviewLoaded && (
        <>
          <SectionLabel>Ulasan</SectionLabel>
          {myReview ? (
            <Card gap={spacing.sm}>
              <Text variant="label" color="secondary">
                Ulasanmu
              </Text>
              <View
                style={styles.starsStatic}
                accessible
                accessibilityLabel={`Ulasanmu ${myReview.rating} dari 5 bintang`}>
                {STARS.map((n) => (
                  <Feather
                    key={n}
                    name="star"
                    size={22}
                    color={n <= myReview.rating ? colors.warnInk : colors.secondary}
                  />
                ))}
              </View>
              {!!myReview.comment && (
                <Text variant="body" color="body">
                  {myReview.comment}
                </Text>
              )}
            </Card>
          ) : (
            <Card gap={spacing.md}>
              <Text variant="body" color="body">
                Bagaimana pesananmu? Beri bintang:
              </Text>

              <View
                style={styles.starRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Beri bintang">
                {STARS.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    style={styles.starTap}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} bintang`}
                    accessibilityState={{ checked: n === rating }}>
                    <Feather
                      name="star"
                      size={28}
                      color={n <= rating ? colors.warnInk : colors.secondary}
                    />
                  </Pressable>
                ))}
              </View>
              {/* The rating is never carried by colour alone. */}
              <Text variant="meta" color="secondary" accessibilityElementsHidden>
                {rating > 0 ? `${rating} dari 5 bintang` : 'Belum ada bintang dipilih'}
              </Text>

              <Field
                multiline
                placeholder="Tulis komentar (opsional)…"
                value={comment}
                onChangeText={setComment}
                accessibilityLabel="Komentar ulasan"
              />
              <Button
                label="Kirim Ulasan"
                onPress={sendReview}
                disabled={rating < 1}
                loading={busy}
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

// Only the timeline rail is screen-specific geometry; everything else here
// is the kit.
const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  footer: { gap: spacing.sm },
  cancel: { alignSelf: 'center', paddingHorizontal: spacing.xl },
  progress: { gap: spacing.sm },
  timeline: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  connector: {
    position: 'absolute',
    top: 15,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
  },
  connectorDone: { backgroundColor: colors.primary },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.primary },
  dotCurrent: { borderWidth: 3, borderColor: colors.primarySoft },
  starRow: { flexDirection: 'row', alignSelf: 'flex-start' },
  starTap: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsStatic: { flexDirection: 'row', gap: spacing.xs },
});
