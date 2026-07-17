import { Feather } from '@expo/vector-icons';
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
import {
  fetchDailyRevenue,
  fetchRecap,
  type DailyRevenue,
  type Recap,
  type RecapPeriod,
} from '@/lib/recaps';
import { colors, fonts, radius, scrollWrap } from '@/lib/theme';

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
];

const HERO_LABEL: Record<RecapPeriod, string> = {
  today: 'Omzet hari ini',
  week: 'Omzet 7 hari',
  month: 'Omzet bulan ini',
};

export default function StoreRecap() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<RecapPeriod>('today');
  const [recap, setRecap] = useState<Recap | null>(null);
  const [daily, setDaily] = useState<DailyRevenue[] | null>(null);

  const load = useCallback(
    (p: RecapPeriod) => {
      if (!id) return;
      setRecap(null); // show the spinner while switching periods
      fetchRecap(id, p)
        .then(setRecap)
        .catch((e) => console.warn('fetchRecap:', e.message));
      fetchDailyRevenue(id)
        .then(setDaily)
        .catch((e) => console.warn('fetchDailyRevenue:', e.message));
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period])
  );

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const maxDaily = daily ? Math.max(...daily.map((d) => d.total), 1) : 1;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backWrap}
        accessibilityRole="button"
        accessibilityLabel="Kembali">
        <Feather name="chevron-left" size={18} color={colors.primaryDark} />
        <Text style={styles.back}>Toko</Text>
      </Pressable>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Rekap</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <View style={styles.seg}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.segOpt, period === p.key && styles.segOptOn]}
            onPress={() => setPeriod(p.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p.key }}>
            <Text style={[styles.segText, period === p.key && styles.segTextOn]}>
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
          {/* Honest recap (PRD S-3): paid and unpaid are NEVER summed together,
              so the green number always matches the cash drawer. */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{HERO_LABEL[period]}</Text>
            <Text style={styles.heroValue}>{formatRupiah(recap.revenuePaid)}</Text>
            <Text style={styles.heroMeta}>
              {recap.orderCount} pesanan selesai
              {recap.revenueUnpaid > 0 ? ' · sebagian belum dibayar' : ' · semua lunas'}
            </Text>
          </View>

          <View style={styles.smallRow}>
            <View style={[styles.smallCard, styles.unpaidCard]}>
              <Text style={styles.smallLabelUnpaid}>Belum dibayar</Text>
              <Text style={styles.unpaidValue}>{formatRupiah(recap.revenueUnpaid)}</Text>
              <Text style={styles.unpaidHint}>tagih lewat chat pesanan</Text>
            </View>
            <View style={styles.smallCard}>
              <Text style={styles.smallLabel}>Terlaris</Text>
              <Text style={styles.smallValue} numberOfLines={2}>
                {recap.topItems[0]?.name ?? '—'}
              </Text>
              <Text style={styles.smallMeta}>
                {recap.topItems[0] ? `${recap.topItems[0].totalQty}× terjual` : 'belum ada'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Omzet 7 hari terakhir</Text>
          <View style={styles.chartCard}>
            {daily ? (
              <View style={styles.chart}>
                {daily.map((d, i) => (
                  <View key={i} style={styles.chartCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((d.total / maxDaily) * 100, 3)}%`,
                          backgroundColor: d.isToday
                            ? colors.primary
                            : colors.primaryChipBorder,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, d.isToday && styles.barLabelToday]}>
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>

          {recap.topItems.length > 1 && (
            <>
              <Text style={styles.sectionLabel}>Barang terlaris</Text>
              <View style={styles.topCard}>
                {recap.topItems.map((item, idx) => (
                  <View key={item.name} style={styles.topRow}>
                    <Text style={styles.topRank}>{idx + 1}</Text>
                    <Text style={styles.topName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.topQty}>{item.totalQty}×</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { ...scrollWrap, gap: 12 },
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  date: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: 4,
  },
  segOpt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  segOptOn: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.body },
  segTextOn: { color: colors.onPrimary },
  loading: { marginTop: 48, alignItems: 'center' },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 22,
    marginTop: 6,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  heroLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.85)',
  },
  heroValue: {
    fontFamily: fonts.heading,
    fontSize: 38,
    color: colors.onPrimary,
    marginTop: 6,
  },
  heroMeta: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: 'rgba(255,255,255,.9)',
    marginTop: 6,
  },
  smallRow: { flexDirection: 'row', gap: 10 },
  smallCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 4,
  },
  unpaidCard: { backgroundColor: colors.amberBg },
  smallLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.secondary,
  },
  smallLabelUnpaid: {
    fontFamily: fonts.bodySemi,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.sunnyText,
  },
  smallValue: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, lineHeight: 20 },
  smallMeta: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primaryDark },
  unpaidValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.sunnyText },
  unpaidHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.sunnyText,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 12,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    height: 130,
  },
  chartCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  barLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  barLabelToday: { fontFamily: fonts.bodyBold, color: colors.primaryDeep },
  topCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topRank: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.secondary,
    width: 22,
    textAlign: 'center',
  },
  topName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, flex: 1 },
  topQty: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primaryDark },
});
