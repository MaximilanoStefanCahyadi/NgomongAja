import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { createAddress, listAddresses, type Address } from '@/lib/addresses';
import { useAuth } from '@/lib/auth-context';
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

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'COD — bayar di tempat',
  gopay: 'GoPay',
  transfer: 'Transfer Bank',
};

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
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [phase, setPhase] = useState<Phase>('review');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    listActiveProducts(storeId).then(setAllProducts).catch(() => {});
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
  const fee = fulfillment === 'delivery' ? DELIVERY_FEE : 0;
  const grandTotal = itemsTotal + fee;

  const needsAddress = fulfillment === 'delivery' && !addressId && !newAddress.trim();
  const canConfirm =
    lines.length > 0 && unresolved === 0 && !needsAddress && phase === 'review';

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
    } catch (e: any) {
      setPhase('review');
      Alert.alert('Gagal membuat pesanan', e.message);
    }
  };

  const payNow = async () => {
    if (!orderId) return;
    try {
      await markPaidByBuyer(orderId);
      setPhase('success');
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    }
  };

  if (phase === 'pay') {
    return (
      <View style={styles.center}>
        <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
        <Text style={styles.title}>{METHOD_LABELS[method]}</Text>
        <Text style={styles.payAmount}>{formatRupiah(total)}</Text>
        <Pressable style={styles.button} onPress={payNow}>
          <Text style={styles.buttonText}>Bayar Sekarang (SIMULASI)</Text>
        </Pressable>
        <Pressable onPress={() => setPhase('success')}>
          <Text style={styles.linkText}>Bayar nanti</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'success') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={styles.title}>Pesanan terkirim!</Text>
        <Text style={styles.hint}>
          Pesananmu menunggu konfirmasi penjual.{'\n'}Total {formatRupiah(total)} ·{' '}
          {method === 'cash' ? 'bayar di tempat' : METHOD_LABELS[method]}
        </Text>
        <Pressable style={styles.button} onPress={() => router.dismissAll()}>
          <Text style={styles.buttonText}>Kembali ke Beranda</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Kembali</Text>
      </Pressable>
      <Text style={styles.title}>Periksa Pesanan</Text>
      <Text style={styles.transcript}>"{draft.transcript}"</Text>

      {lines.map((line) => (
        <View key={line.key} style={styles.lineCard}>
          {line.product ? (
            <>
              <View style={styles.lineHeader}>
                <Text style={styles.lineName}>{line.product.name}</Text>
                <Pressable onPress={() => removeLine(line.key)}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.lineControls}>
                <Pressable
                  style={styles.stepBtn}
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
                <Pressable onPress={() => removeLine(line.key)}>
                  <Text style={styles.remove}>✕</Text>
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
                      .filter((p) => p.name.toLowerCase().includes(line.query.toLowerCase()))
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

      <Text style={styles.sectionTitle}>Pengambilan</Text>
      <View style={styles.rowGap}>
        <Pressable
          style={[styles.choice, fulfillment === 'pickup' && styles.choiceSelected]}
          onPress={() => setFulfillment('pickup')}>
          <Text style={styles.choiceText}>Ambil sendiri</Text>
        </Pressable>
        <Pressable
          style={[styles.choice, fulfillment === 'delivery' && styles.choiceSelected]}
          onPress={() => setFulfillment('delivery')}>
          <Text style={styles.choiceText}>Diantar (+{formatRupiah(DELIVERY_FEE)})</Text>
        </Pressable>
      </View>

      {fulfillment === 'delivery' && (
        <View style={styles.addressBox}>
          <Text style={styles.hintSmall}>Antar ke:</Text>
          {addresses.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.choice, addressId === a.id && styles.choiceSelected]}
              onPress={() => {
                setAddressId(a.id);
                setNewAddress('');
              }}>
              <Text style={styles.choiceText}>
                {a.label ? `${a.label} — ` : ''}
                {a.full_address}
              </Text>
            </Pressable>
          ))}
          <TextInput
            style={styles.search}
            placeholder="Label alamat baru (contoh: Rumah)"
            value={newLabel}
            onChangeText={setNewLabel}
          />
          <TextInput
            style={[styles.search, { minHeight: 60 }]}
            placeholder="Atau tulis alamat baru lengkap di sini…"
            multiline
            value={newAddress}
            onChangeText={(t) => {
              setNewAddress(t);
              if (t.trim()) setAddressId(null);
            }}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Pembayaran</Text>
      <Text style={styles.demoBanner}>DEMO — tidak ada uang berpindah</Text>
      <View style={styles.rowGap}>
        {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.choice, method === m && styles.choiceSelected]}
            onPress={() => setMethod(m)}>
            <Text style={styles.choiceText}>{METHOD_LABELS[m]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.totals}>
        <Text style={styles.totalRow}>Barang: {formatRupiah(itemsTotal)}</Text>
        {fee > 0 && <Text style={styles.totalRow}>Ongkir: {formatRupiah(fee)}</Text>}
        <Text style={styles.grandTotal}>Total: {formatRupiah(grandTotal)}</Text>
      </View>

      {unresolved > 0 && (
        <Text style={styles.warn}>
          {unresolved} barang belum dipilih — pilih produknya atau hapus dulu.
        </Text>
      )}

      <Pressable
        style={[styles.button, !canConfirm && styles.buttonDisabled]}
        onPress={confirm}
        disabled={!canConfirm}>
        {phase === 'placing' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Buat Pesanan</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 10 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 'bold' },
  transcript: { fontSize: 14, fontStyle: 'italic', color: '#555', marginBottom: 6 },
  hint: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  hintSmall: { fontSize: 13, color: '#666' },
  lineCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 10,
  },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lineName: { fontSize: 15, fontWeight: '600', flex: 1 },
  remove: { fontSize: 16, color: '#dc2626', paddingHorizontal: 4 },
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: { fontSize: 18, color: '#15803d', fontWeight: 'bold' },
  qty: { fontSize: 15, fontWeight: '500', minWidth: 56, textAlign: 'center' },
  lineSubtotal: { marginLeft: 'auto', fontSize: 15, fontWeight: '600', color: '#15803d' },
  candidates: { gap: 6 },
  candidate: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fafafa',
  },
  candidateText: { fontSize: 14 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10 },
  rowGap: { gap: 8 },
  choice: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  choiceSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  choiceText: { fontSize: 14, fontWeight: '500' },
  addressBox: { gap: 8 },
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
  },
  totals: { marginTop: 10, gap: 2 },
  totalRow: { fontSize: 14, color: '#555', textAlign: 'right' },
  grandTotal: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  payAmount: { fontSize: 34, fontWeight: 'bold' },
  warn: { color: '#b45309', fontSize: 13 },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#a7cbb4' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { color: '#666', fontSize: 14 },
});
