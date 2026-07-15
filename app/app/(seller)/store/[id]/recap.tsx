import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatRupiah } from '@/lib/format';
import { fetchRecap, type Recap, type RecapPeriod } from '@/lib/recaps';

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
];

export default function StoreRecap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<RecapPeriod>('today');
  const [recap, setRecap] = useState<Recap | null>(null);

  const load = useCallback(
    (p: RecapPeriod) => {
      if (!id) return;
      setRecap(null); // show the spinner while switching periods
      fetchRecap(id, p)
        .then(setRecap)
        .catch((e) => console.warn('fetchRecap:', e.message));
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Kembali</Text>
      </Pressable>
      <Text style={styles.title}>Rekap Penjualan</Text>

      <View style={styles.chipRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.chip, period === p.key && styles.chipActive]}
            onPress={() => setPeriod(p.key)}>
            <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!recap ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          {/* Honest recap (PRD S-3): paid and unpaid are NEVER summed together,
              so the green number always matches the cash drawer. */}
          <View style={[styles.card, styles.paidCard]}>
            <Text style={styles.paidLabel}>Selesai & dibayar</Text>
            <Text style={styles.paidValue}>{formatRupiah(recap.revenuePaid)}</Text>
          </View>

          <View style={[styles.card, styles.unpaidCard]}>
            <Text style={styles.unpaidLabel}>Selesai, belum dibayar</Text>
            <Text style={styles.unpaidValue}>{formatRupiah(recap.revenueUnpaid)}</Text>
            <Text style={styles.unpaidHint}>tagih lewat chat pesanan</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Jumlah pesanan selesai</Text>
            <Text style={styles.countValue}>{recap.orderCount}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Barang terlaris</Text>
            {recap.topItems.length === 0 ? (
              <Text style={styles.empty}>Belum ada penjualan di periode ini.</Text>
            ) : (
              recap.topItems.map((item, idx) => (
                <View key={item.name} style={styles.topItemRow}>
                  <Text style={styles.topItemRank}>{idx + 1}.</Text>
                  <Text style={styles.topItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.topItemQty}>{item.totalQty}×</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 12 },
  back: { color: '#16a34a', fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 14, color: '#444' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  loading: { marginTop: 48, alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 4,
  },
  cardLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  paidCard: { backgroundColor: '#f0fdf4', borderColor: '#16a34a', borderWidth: 2 },
  paidLabel: { fontSize: 13, color: '#15803d', fontWeight: '600' },
  paidValue: { fontSize: 30, fontWeight: 'bold', color: '#15803d' },
  unpaidCard: { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  unpaidLabel: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  unpaidValue: { fontSize: 22, fontWeight: 'bold', color: '#92400e' },
  unpaidHint: { fontSize: 12, color: '#92400e', fontStyle: 'italic' },
  countValue: { fontSize: 24, fontWeight: 'bold', color: '#222' },
  empty: { color: '#888', fontSize: 14, marginTop: 4 },
  topItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  topItemRank: { fontSize: 14, color: '#888', width: 20 },
  topItemName: { fontSize: 15, color: '#222', flex: 1 },
  topItemQty: { fontSize: 15, fontWeight: '600', color: '#15803d' },
});
