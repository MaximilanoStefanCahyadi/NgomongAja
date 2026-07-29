import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  IconButton,
  ListState,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  SegmentedControl,
  Tag,
  Text,
} from '@/components/ui';
import { createAddress, listAddresses, type Address } from '@/lib/addresses';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import { clearOrderDraft, getOrderDraft } from '@/lib/order-draft';
import {
  attachRecording,
  DELIVERY_FEE,
  markPaidByBuyer,
  placeOrder,
  type Fulfillment,
  type PaymentMethod,
} from '@/lib/orders';
import { listActiveProducts, type Product } from '@/lib/products';
import { PAYMENT_METHOD_LABEL } from '@/lib/status-ui';
import { getStore, type Store } from '@/lib/stores';
import { colors, layout, radius, spacing } from '@/lib/theme';

type Line = {
  key: string;
  spokenName: string;
  quantity: number;
  unit: string;
  product: Product | null; // null = still needs resolving
  candidates: Product[]; // ambiguous suggestions (empty = use search)
  query: string; // manual search text for unmatched items
};

type Phase = 'review' | 'placing' | 'pay' | 'success';

export default function ReviewOrder() {
  const { id: storeId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const draft = useMemo(() => getOrderDraft(), []);

  const [lines, setLines] = useState<Line[]>(() =>
    (draft?.results ?? []).map((r, i) => ({
      key: String(i),
      spokenName: r.item.name,
      quantity: r.item.quantity,
      unit: r.item.unit,
      product: r.kind === 'matched' ? r.product : null,
      candidates: r.kind === 'ambiguous' ? r.candidates : [],
      query: '',
    }))
  );
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [writingNewAddress, setWritingNewAddress] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [phase, setPhase] = useState<Phase>('review');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [storeInfo, setStoreInfo] = useState<Store | null>(null);

  useEffect(() => {
    if (!storeId) return;
    listActiveProducts(storeId).then(setAllProducts).catch(() => {});
    getStore(storeId).then(setStoreInfo).catch(() => {}); // PA-8: per-store fee
  }, [storeId]);

  useEffect(() => {
    if (!profile) return;
    listAddresses(profile.id)
      .then((a) => {
        setAddresses(a);
        if (a.length > 0) setAddressId(a[0].id);
      })
      .catch(() => {});
  }, [profile]);

  if (!draft || !storeId) {
    // Deep link / reload without a draft: nothing to review.
    return (
      <Screen centered>
        <ListState
          state="empty"
          icon="shopping-cart"
          message="Tidak ada pesanan untuk diperiksa."
          action={{ label: 'Kembali', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const step = (unit: string) => (unit === 'kg' || unit === 'liter' ? 0.5 : 1);
  const fmtQty = (q: number) => String(q).replace('.', ',');

  const resolved = lines.filter((l) => l.product !== null);
  const unresolvedAmbiguous = lines.filter(
    (l) => l.product === null && l.candidates.length > 0
  ).length;
  const itemsTotal = resolved.reduce(
    (sum, l) => sum + Math.round(l.product!.price * l.quantity),
    0
  );
  const storeFee = storeInfo?.delivery_fee ?? DELIVERY_FEE;
  const fee = fulfillment === 'delivery' ? storeFee : 0;
  const grandTotal = itemsTotal + fee;

  // The new-address inputs only show when the user asks for them (or has no
  // saved address at all) — a selected saved address keeps the form short.
  const showNewAddressForm = addresses.length === 0 || writingNewAddress;
  const needsAddress = fulfillment === 'delivery' && !addressId && !newAddress.trim();
  const canConfirm =
    lines.length > 0 && unresolvedAmbiguous === 0 && !needsAddress && phase === 'review';

  // The disabled button explains itself instead of just being grey.
  const confirmLabel =
    unresolvedAmbiguous > 0
      ? `Pilih dulu ${unresolvedAmbiguous} barang di atas`
      : needsAddress
        ? 'Pilih alamat dulu'
        : 'Kirim Pesanan';

  const confirm = async () => {
    if (!profile) return;
    setPhase('placing');
    try {
      // Delivery: snapshot the chosen (or freshly typed) address text.
      let deliveryAddress: string | null = null;
      if (fulfillment === 'delivery') {
        if (newAddress.trim()) {
          const created = await createAddress(
            profile.id,
            newLabel.trim() || 'Alamat',
            newAddress.trim()
          );
          deliveryAddress = created.full_address;
        } else {
          const chosen = addresses.find((a) => a.id === addressId)!;
          deliveryAddress = `${chosen.label ? chosen.label + ' — ' : ''}${chosen.full_address}`;
        }
      }

      const newOrderId = await placeOrder({
        storeId,
        fulfillment,
        deliveryAddress,
        paymentMethod: method,
        lines: resolved.map((l) => ({ productId: l.product!.id, quantity: l.quantity })),
      });
      setOrderId(newOrderId);
      setTotal(grandTotal);

      // Best-effort: the order is valid even if the audio upload fails.
      if (draft.audioUri) {
        attachRecording(profile.id, newOrderId, draft.audioUri, {
          transcript: draft.transcript,
          items: resolved.map((l) => ({ name: l.product!.name, quantity: l.quantity })),
        }).catch((e) => console.warn('attachRecording:', e.message));
      }

      clearOrderDraft();
      setPhase(method === 'cash' ? 'success' : 'pay');
    } catch (e) {
      setPhase('review');
      Alert.alert('Gagal membuat pesanan', friendlyError(e));
    }
  };

  const payNow = async () => {
    if (!orderId) return;
    try {
      await markPaidByBuyer(orderId);
      setPhase('success');
    } catch (e) {
      Alert.alert('Gagal', friendlyError(e));
    }
  };

  if (phase === 'pay') {
    return (
      <Screen centered>
        <Tag tone="warn" label="DEMO — tidak ada uang berpindah" />
        <Text variant="title" align="center">
          {PAYMENT_METHOD_LABEL[method]}
        </Text>
        {/* The one big number on this stage. */}
        <Text variant="displayXl" align="center">
          {formatRupiah(total)}
        </Text>
        <Button
          label="Bayar Sekarang"
          onPress={payNow}
          fullWidth={false}
          accessibilityHint="Coba-coba saja — uang tidak berpindah"
        />
        <Button
          label="Bayar nanti"
          variant="quiet"
          size="md"
          fullWidth={false}
          onPress={() => setPhase('success')}
        />
      </Screen>
    );
  }

  if (phase === 'success') {
    return (
      <Screen centered>
        <View style={styles.successIcon}>
          <Feather name="check" size={36} color={colors.successInk} />
        </View>
        <Text variant="display" align="center" accessibilityRole="header">
          Hore, pesanan terkirim!
        </Text>
        <Text variant="body" color="body" align="center">
          Selamat, belanjamu beres tanpa antre! 🥳{'\n'}
          Pesananmu menunggu konfirmasi penjual.
        </Text>
        <Text variant="money" align="center">
          Total {formatRupiah(total)} · {PAYMENT_METHOD_LABEL[method]}
        </Text>
        <Button label="Kembali ke Beranda" onPress={() => router.dismissAll()} fullWidth={false} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboard
      contentContainerStyle={styles.content}
      footer={
        <Button
          label={confirmLabel}
          onPress={confirm}
          disabled={!canConfirm}
          loading={phase === 'placing'}
        />
      }>
      <ScreenHeader
        title="Periksa Pesanan"
        backLabel={`Kembali ke ${storeInfo?.name ?? 'Toko'}`}
      />

      {!!storeInfo?.name && (
        <View style={styles.storeRow}>
          <Feather name="shopping-bag" size={16} color={colors.primaryInk} />
          <Text variant="label" color="primary" numberOfLines={1} style={styles.flex}>
            {storeInfo.name}
          </Text>
        </View>
      )}

      {/* Same treatment as the "Yang kami dengar" stage this screen follows. */}
      <Card tone="success" row style={styles.transcript}>
        <Feather name="mic" size={18} color={colors.successInk} style={styles.transcriptIcon} />
        <Text variant="transcript" color="success" style={styles.transcriptText}>
          &quot;{draft.transcript}&quot;
        </Text>
      </Card>

      <SectionLabel first>Barang</SectionLabel>

      <View style={styles.lines}>
        {lines.map((line) => {
          const product = line.product;

          if (product) {
            return (
              <Card key={line.key} padding="sm" gap={spacing.sm}>
                <View style={styles.lineHeader}>
                  <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <IconButton
                    icon="x"
                    tone="danger"
                    onPress={() => removeLine(line.key)}
                    accessibilityLabel={`Hapus ${product.name}`}
                  />
                </View>
                <View style={styles.lineControls}>
                  <IconButton
                    icon="minus"
                    accessibilityLabel="Kurangi jumlah"
                    onPress={() =>
                      updateLine(line.key, {
                        quantity: Math.max(step(line.unit), line.quantity - step(line.unit)),
                      })
                    }
                  />
                  <Text variant="bodyStrong" align="center" style={styles.qty}>
                    {fmtQty(line.quantity)} {line.unit !== 'default' ? line.unit : ''}
                  </Text>
                  <IconButton
                    icon="plus"
                    accessibilityLabel="Tambah jumlah"
                    onPress={() =>
                      updateLine(line.key, { quantity: line.quantity + step(line.unit) })
                    }
                  />
                  <Text variant="money" style={styles.lineSubtotal}>
                    {formatRupiah(Math.round(product.price * line.quantity))}
                  </Text>
                </View>
              </Card>
            );
          }

          // Unresolved. The amber Tag + icon is the ONE "you must act" signal —
          // the card itself stays neutral so the tag is actually visible on it.
          const ambiguous = line.candidates.length > 0;
          return (
            <Card key={line.key} padding="sm" gap={spacing.sm}>
              <View style={styles.lineHeader}>
                <Feather
                  name={ambiguous ? 'help-circle' : 'search'}
                  size={18}
                  color={colors.warnInk}
                />
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                  &quot;{line.spokenName}&quot; × {fmtQty(line.quantity)}
                </Text>
                <IconButton
                  icon="x"
                  tone="danger"
                  onPress={() => removeLine(line.key)}
                  accessibilityLabel={`Hapus ${line.spokenName}`}
                />
              </View>

              <Tag tone="warn" label={ambiguous ? 'Pilih dulu' : 'Tidak ketemu'} />

              {ambiguous ? (
                <View style={styles.choices}>
                  <Text variant="label" color="body">
                    Maksud kamu yang mana?
                  </Text>
                  {line.candidates.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.choice, styles.onCard]}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}, ${formatRupiah(c.price)}`}
                      onPress={() => updateLine(line.key, { product: c })}>
                      <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                        {c.name}
                      </Text>
                      <Text variant="money">{formatRupiah(c.price)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.choices}>
                  <Text variant="meta" color="secondary">
                    {`Tidak ditemukan: "${line.spokenName}"`}
                  </Text>
                  <Field
                    placeholder="Cari produk di toko ini…"
                    leftIcon="search"
                    accessibilityLabel={`Cari pengganti untuk ${line.spokenName}`}
                    value={line.query}
                    onChangeText={(q) => updateLine(line.key, { query: q })}
                  />
                  {line.query.length >= 2 &&
                    allProducts
                      .filter((p) => p.name.toLowerCase().includes(line.query.toLowerCase()))
                      .slice(0, 5)
                      .map((p) => (
                        <Pressable
                          key={p.id}
                          style={[styles.choice, styles.onCard]}
                          accessibilityRole="button"
                          accessibilityLabel={`${p.name}, ${formatRupiah(p.price)}`}
                          onPress={() => updateLine(line.key, { product: p, query: '' })}>
                          <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                            {p.name}
                          </Text>
                          <Text variant="money">{formatRupiah(p.price)}</Text>
                        </Pressable>
                      ))}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <SectionLabel>Cara terima</SectionLabel>
      <SegmentedControl<Fulfillment>
        options={[
          { key: 'pickup', label: 'Ambil Sendiri' },
          { key: 'delivery', label: `Diantar (+${formatRupiah(storeFee)})` },
        ]}
        value={fulfillment}
        onChange={setFulfillment}
      />

      {fulfillment === 'delivery' && (
        <View style={styles.addressBox}>
          <Text variant="label" color="body">
            Antar ke:
          </Text>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {addresses.map((a) => {
              const selected = addressId === a.id;
              return (
                <Pressable
                  key={a.id}
                  // ONE signal for "selected": the green fill, plus a check icon
                  // so the state never rests on colour alone.
                  style={[styles.choice, styles.onPaper, selected && styles.choiceOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${a.label ? a.label + ' — ' : ''}${a.full_address}`}
                  onPress={() => {
                    setAddressId(a.id);
                    setNewAddress('');
                    setWritingNewAddress(false);
                  }}>
                  <View style={styles.choiceText}>
                    <Text variant="bodyStrong" color={selected ? 'primaryInk' : 'text'}>
                      {a.label ?? a.full_address}
                    </Text>
                    {!!a.label && (
                      <Text variant="meta" color={selected ? 'primaryInk' : 'secondary'}>
                        {a.full_address}
                      </Text>
                    )}
                  </View>
                  {selected && <Feather name="check" size={20} color={colors.primaryInk} />}
                </Pressable>
              );
            })}
          </View>

          {!showNewAddressForm ? (
            <Button
              label="Tulis alamat baru"
              variant="secondary"
              size="md"
              icon="plus"
              fullWidth={false}
              onPress={() => setWritingNewAddress(true)}
            />
          ) : (
            <>
              <Field
                label="Label alamat baru"
                placeholder="Contoh: Rumah"
                value={newLabel}
                onChangeText={setNewLabel}
              />
              <Field
                label="Alamat lengkap"
                placeholder="Tulis alamat baru lengkap di sini…"
                multiline
                hint={needsAddress ? 'Alamat wajib diisi untuk pesanan yang diantar.' : undefined}
                value={newAddress}
                onChangeText={(t) => {
                  setNewAddress(t);
                  if (t.trim()) setAddressId(null);
                }}
              />
            </>
          )}
        </View>
      )}

      <SectionLabel>Pembayaran</SectionLabel>
      <Tag tone="warn" label="DEMO — tidak ada uang berpindah" />
      <View accessibilityRole="radiogroup" style={styles.methods}>
        {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => {
          const selected = method === m;
          return (
            <Pressable
              key={m}
              style={[styles.choice, styles.onPaper, selected && styles.choiceOn]}
              onPress={() => setMethod(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={PAYMENT_METHOD_LABEL[m]}>
              <Text
                variant="bodyStrong"
                color={selected ? 'primaryInk' : 'text'}
                style={styles.flex}>
                {PAYMENT_METHOD_LABEL[m]}
              </Text>
              {selected && <Feather name="check" size={20} color={colors.primaryInk} />}
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.totals}>
        <Row title="Barang" value={formatRupiah(itemsTotal)} />
        <Row title="Ongkir" value={formatRupiah(fee)} />
        <Row title="Total" value={formatRupiah(grandTotal)} emphasis="total" />
      </Card>

      {unresolvedAmbiguous > 0 && (
        // The warn fill + left rule is the whole "needs attention" signal.
        <Card tone="warn" row style={styles.notice}>
          <Feather name="alert-triangle" size={18} color={colors.warnInk} />
          <Text variant="body" color="body" style={styles.flex}>
            {unresolvedAmbiguous} barang perlu dipilih dulu — pilih produknya atau hapus.
          </Text>
        </Card>
      )}
      {unresolvedAmbiguous === 0 && lines.some((l) => l.product === null) && (
        <Text variant="meta" color="secondary" style={styles.notice}>
          Barang yang tidak ditemukan akan dilewati kalau tidak kamu pilih atau hapus.
        </Text>
      )}
    </Screen>
  );
}

// Screen-specific layout only — every control above comes from the kit.
const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  flex: { flex: 1 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  transcript: { marginTop: spacing.md, alignItems: 'flex-start' },
  transcriptIcon: { marginTop: 3 },
  transcriptText: { flex: 1, fontStyle: 'italic' },
  lines: { gap: spacing.sm },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qty: { minWidth: 64 },
  lineSubtotal: { marginLeft: 'auto' },
  choices: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouch,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  /** Choices sitting on paper take the card fill… */
  onPaper: { backgroundColor: colors.card },
  /** …and choices nested inside a card invert to paper, so they still read. */
  onCard: { backgroundColor: colors.bg },
  choiceOn: { backgroundColor: colors.primarySoft },
  choiceText: { flex: 1, gap: 2 },
  addressBox: { gap: spacing.sm, marginTop: spacing.sm },
  methods: { gap: spacing.sm, marginTop: spacing.sm },
  totals: { marginTop: spacing.xl },
  notice: { marginTop: spacing.md },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    // Toska aktif is the success hue — orange here would read as a CTA.
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
