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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRupiah } from '@/lib/format';
import { fetchRecap, type Recap, type RecapPeriod } from '@/lib/recaps';
import { colors, radius, scrollWrap } from '@/lib/theme';

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
];

// Podium medals for the three best sellers — a little reward for the seller.
const MEDALS = ['🥇', '🥈', '🥉'];

export default function StoreRecap() {
  const insets = useSafeAreaInsets();
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
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Toko</Text>
      </Pressable>
      <Text style={styles.title}>Rekap Penjualan 📊</Text>

      <View style={styles.chipRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.chip, period === p.key && styles.chipActive]}
            onPress={() => setPeriod(p.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p.key }}>
            <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!recap ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {recap.revenuePaid > 0 && (
            <View style={styles.cheerBanner}>
              <Text style={styles.cheerText}>🎉 Kerja bagus! Terus semangat, ya!</Text>
            </View>
          )}

          {/* Honest recap (PRD S-3): paid and unpaid are NEVER summed together,
              so the green number always matches the cash drawer. */}
          <View style={[styles.card, styles.paidCard]}>
            <Text style={styles.paidLabel}>💰 Selesai & dibayar</Text>
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
            <Text style={styles.cardLabel}>🏆 Barang terlaris</Text>
            {recap.topItems.length === 0 ? (
              <Text style={styles.empty}>🌱 Belum ada penjualan periode ini. Semangat, ya!</Text>
            ) : (
              recap.topItems.map((item, idx) => (
                <View key={item.name} style={styles.topItemRow}>
                  <Text style={styles.topItemRank}>{MEDALS[idx] ?? `${idx + 1}.`}</Text>
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
  container: { ...scrollWrap, gap: 12 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  cheerBanner: {
    backgroundColor: colors.sunnyBg,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  cheerText: { color: colors.sunnyText, fontSize: 18, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.body },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  loading: { marginTop: 48, alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardLabel: { fontSize: 13, color: colors.body, fontWeight: '600' },
  paidCard: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
  paidLabel: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  paidValue: { fontSize: 32, fontWeight: 'bold', color: colors.primaryDark },
  unpaidCard: { backgroundColor: colors.amberBg, borderColor: colors.amberBorder },
  unpaidLabel: { fontSize: 13, color: colors.amberText, fontWeight: '600' },
  unpaidValue: { fontSize: 22, fontWeight: 'bold', color: colors.amberText },
  unpaidHint: { fontSize: 12, color: colors.amberText, fontStyle: 'italic' },
  countValue: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  empty: { color: colors.body, fontSize: 14, marginTop: 4 },
  topItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  topItemRank: { fontSize: 18, width: 28, textAlign: 'center' },
  topItemName: { fontSize: 15, color: colors.text, flex: 1 },
  topItemQty: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
});
