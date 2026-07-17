import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { colors, fonts, radius, scrollWrap, spacing } from '@/lib/theme';

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
  const insets = useSafeAreaInsets();
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
      <View style={styles.center}>
        <Text style={styles.hint}>Tidak ada pesanan untuk diperiksa.</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const step = (unit: string) => (unit === 'kg' || unit === 'liter' ? 0.5 : 1);
  const fmtQty = (q: number) => String(q).replace('.', ',');

  const resolved = lines.filter((l) => l.product !== null);
  const unresolved = lines.length - resolved.length;
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
    lines.length > 0 && unresolved === 0 && !needsAddress && phase === 'review';

  // The disabled button explains itself instead of just being grey.
  const confirmLabel =
    unresolved > 0
      ? `Pilih dulu ${unresolved} barang di atas`
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
      <View style={styles.center}>
        <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
        <Text style={styles.title}>{PAYMENT_METHOD_LABEL[method]}</Text>
        <Text style={styles.payAmount}>{formatRupiah(total)}</Text>
        <Pressable style={styles.button} onPress={payNow}>
          <Text style={styles.buttonText}>
            Bayar Sekarang (coba-coba, uang tidak berpindah)
          </Text>
        </Pressable>
        <Pressable onPress={() => setPhase('success')} hitSlop={12} style={styles.linkWrap}>
          <Text style={styles.linkText}>Bayar nanti</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'success') {
    return (
      <View style={styles.center}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.title}>Hore, pesanan terkirim!</Text>
        <Text style={styles.hint}>
          Selamat, belanjamu beres tanpa antre! 🥳{'\n'}
          Pesananmu menunggu konfirmasi penjual.{'\n'}Total {formatRupiah(total)} ·{' '}
          {PAYMENT_METHOD_LABEL[method]}
        </Text>
        <Pressable style={styles.button} onPress={() => router.dismissAll()}>
          <Text style={styles.buttonText}>Kembali ke Beranda</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>‹ Kembali ke {storeInfo?.name ?? 'Toko'}</Text>
        </Pressable>
        <Text style={styles.title}>Periksa Pesanan</Text>
        {!!storeInfo?.name && <Text style={styles.storeName}>🏪 {storeInfo.name}</Text>}
        <Text style={styles.transcript}>"{draft.transcript}"</Text>

        {lines.map((line) => (
          <View key={line.key} style={styles.lineCard}>
            {line.product ? (
              <>
                <View style={styles.lineHeader}>
                  <Text style={styles.lineName}>{line.product.name}</Text>
                  <Pressable
                    onPress={() => removeLine(line.key)}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus ${line.product.name}`}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.lineControls}>
                  <Pressable
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Kurangi jumlah"
                    onPress={() =>
                      updateLine(line.key, {
                        quantity: Math.max(step(line.unit), line.quantity - step(line.unit)),
                      })
                    }>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>
                    {fmtQty(line.quantity)} {line.unit !== 'default' ? line.unit : ''}
                  </Text>
                  <Pressable
                    style={styles.stepBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Tambah jumlah"
                    onPress={() =>
                      updateLine(line.key, { quantity: line.quantity + step(line.unit) })
                    }>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                  <Text style={styles.lineSubtotal}>
                    {formatRupiah(Math.round(line.product.price * line.quantity))}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.lineHeader}>
                  <Text style={styles.lineName}>
                    {line.candidates.length > 0 ? '🤔' : '❓'} "{line.spokenName}" ×{' '}
                    {fmtQty(line.quantity)}
                  </Text>
                  <Pressable
                    onPress={() => removeLine(line.key)}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus ${line.spokenName}`}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
                {line.candidates.length > 0 ? (
                  <View style={styles.candidates}>
                    <Text style={styles.hintSmall}>Maksud kamu yang mana?</Text>
                    {line.candidates.map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.candidate}
                        onPress={() => updateLine(line.key, { product: c })}>
                        <Text style={styles.candidateText}>
                          {c.name} · {formatRupiah(c.price)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.candidates}>
                    <TextInput
                      style={styles.search}
                      placeholder="Cari produk di toko ini…"
                      value={line.query}
                      onChangeText={(q) => updateLine(line.key, { query: q })}
                    />
                    {line.query.length >= 2 &&
                      allProducts
                        .filter((p) =>
                          p.name.toLowerCase().includes(line.query.toLowerCase())
                        )
                        .slice(0, 5)
                        .map((p) => (
                          <Pressable
                            key={p.id}
                            style={styles.candidate}
                            onPress={() => updateLine(line.key, { product: p, query: '' })}>
                            <Text style={styles.candidateText}>
                              {p.name} · {formatRupiah(p.price)}
                            </Text>
                          </Pressable>
                        ))}
                  </View>
                )}
              </>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cara terima</Text>
        <View style={styles.seg}>
          <Pressable
            style={[styles.segOpt, fulfillment === 'pickup' && styles.segOptOn]}
            onPress={() => setFulfillment('pickup')}
            accessibilityRole="button"
            accessibilityState={{ selected: fulfillment === 'pickup' }}>
            <Text style={[styles.segText, fulfillment === 'pickup' && styles.segTextOn]}>
              Ambil Sendiri
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segOpt, fulfillment === 'delivery' && styles.segOptOn]}
            onPress={() => setFulfillment('delivery')}
            accessibilityRole="button"
            accessibilityState={{ selected: fulfillment === 'delivery' }}>
            <Text style={[styles.segText, fulfillment === 'delivery' && styles.segTextOn]}>
              Diantar (+{formatRupiah(storeFee)})
            </Text>
          </Pressable>
        </View>

        {fulfillment === 'delivery' && (
          <View style={styles.addressBox}>
            <Text style={styles.hintSmall}>Antar ke:</Text>
            {addresses.map((a) => (
              <Pressable
                key={a.id}
                style={[styles.choice, addressId === a.id && styles.choiceSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: addressId === a.id }}
                onPress={() => {
                  setAddressId(a.id);
                  setNewAddress('');
                  setWritingNewAddress(false);
                }}>
                <Text style={styles.choiceText}>
                  {a.label ? `${a.label} — ` : ''}
                  {a.full_address}
                </Text>
              </Pressable>
            ))}
            {!showNewAddressForm ? (
              <Pressable
                style={styles.newAddressToggle}
                onPress={() => setWritingNewAddress(true)}
                accessibilityRole="button">
                <Text style={styles.newAddressToggleText}>+ Tulis alamat baru</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.search}
                  placeholder="Label alamat baru (contoh: Rumah)"
                  value={newLabel}
                  onChangeText={setNewLabel}
                />
                <TextInput
                  style={[styles.search, { minHeight: 60 }]}
                  placeholder="Tulis alamat baru lengkap di sini…"
                  multiline
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

        <Text style={styles.sectionTitle}>Pembayaran</Text>
        <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
        <View style={styles.radioGroup}>
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <Pressable
              key={m}
              style={styles.radioRow}
              onPress={() => setMethod(m)}
              accessibilityRole="radio"
              accessibilityState={{ selected: method === m }}>
              <View style={[styles.radioDot, method === m && styles.radioDotOn]} />
              <Text style={styles.radioLabel}>{PAYMENT_METHOD_LABEL[m]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text style={styles.totalRow}>Barang</Text>
            <Text style={styles.totalRow}>{formatRupiah(itemsTotal)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalRow}>Ongkir</Text>
            <Text style={styles.totalRow}>{formatRupiah(fee)}</Text>
          </View>
          <View style={[styles.totalLine, { marginTop: 6 }]}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>{formatRupiah(grandTotal)}</Text>
          </View>
        </View>

        {unresolved > 0 && (
          <Text style={styles.warn}>
            ⚠️ {unresolved} barang belum dipilih — pilih produknya atau hapus dulu.
          </Text>
        )}

        <Pressable
          style={[styles.button, !canConfirm && styles.buttonDisabled]}
          onPress={confirm}
          disabled={!canConfirm}>
          {phase === 'placing' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{confirmLabel}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  container: { ...scrollWrap, gap: 10 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  storeName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.primaryDark },
  transcript: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.body,
    marginBottom: 6,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.body,
    textAlign: 'center',
    lineHeight: 23,
  },
  hintSmall: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  successEmoji: { fontSize: 72 },
  lineCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineName: { fontFamily: fonts.bodySemi, fontSize: 15, flex: 1, color: colors.text },
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 18, color: colors.danger },
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.primaryDeep },
  qty: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    minWidth: 56,
    textAlign: 'center',
    color: colors.text,
  },
  lineSubtotal: {
    marginLeft: 'auto',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  candidates: { gap: 6 },
  candidate: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.bg,
  },
  candidateText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  search: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.body,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 16,
  },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 3,
  },
  segOpt: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segOptOn: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.body },
  segTextOn: { color: colors.onPrimary },
  radioGroup: { gap: 4 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.bg,
  },
  radioDotOn: { borderWidth: 5.5, borderColor: colors.primary },
  radioLabel: { fontFamily: fonts.body, fontSize: 14.5, color: colors.text },
  choice: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    padding: 13,
    backgroundColor: colors.card,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  addressBox: { gap: spacing.sm },
  newAddressToggle: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.pill,
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  newAddressToggleText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
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
  },
  totals: { marginTop: 14, gap: 4, paddingHorizontal: 4 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { fontFamily: fonts.body, fontSize: 14, color: colors.body },
  grandTotal: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  payAmount: { fontFamily: fonts.heading, fontSize: 38, color: colors.text },
  warn: { fontFamily: fonts.bodySemi, color: colors.sunnyText, fontSize: 15 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontFamily: fonts.heading,
    textAlign: 'center',
  },
  linkWrap: { paddingVertical: 12 },
  linkText: { fontFamily: fonts.body, color: colors.body, fontSize: 14 },
});
