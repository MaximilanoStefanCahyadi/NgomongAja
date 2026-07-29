import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  Card,
  ListState,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { formatRupiah } from '@/lib/format';
import {
  fetchDailyRevenue,
  fetchRecap,
  type DailyRevenue,
  type Recap,
  type RecapPeriod,
} from '@/lib/recaps';
import { colors, radius, spacing } from '@/lib/theme';

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
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader title="Rekap" backLabel="Toko" subtitle={today} />

      <View style={styles.periods}>
        <SegmentedControl<RecapPeriod>
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
      </View>

      {!recap ? (
        <ListState state="loading" message="Menghitung rekap…" />
      ) : (
        <>
          {/* Honest recap (PRD S-3): paid and unpaid are NEVER summed together,
              so the green number always matches the cash drawer. */}
          <View style={styles.hero}>
            <Text variant="label" color="onPrimarySoft">
              {HERO_LABEL[period]}
            </Text>
            <Text variant="displayXl" color="onPrimary">
              {formatRupiah(recap.revenuePaid)}
            </Text>
            <Text variant="meta" color="onPrimarySoft">
              {recap.orderCount} pesanan selesai
              {recap.revenueUnpaid > 0 ? ' · sebagian belum dibayar' : ' · semua lunas'}
            </Text>
          </View>

          <View style={styles.smallRow}>
            {/* The ONE non-neutral surface in this row: money still owed. */}
            <Card tone="warn" padding="sm" gap={spacing.xs} style={styles.smallCard}>
              <Text variant="meta" color="warn">
                Belum dibayar
              </Text>
              <Text variant="money" color="warn">
                {formatRupiah(recap.revenueUnpaid)}
              </Text>
              <Text variant="tag" color="warn">
                tagih lewat chat pesanan
              </Text>
            </Card>
            <Card padding="sm" gap={spacing.xs} style={styles.smallCard}>
              <Text variant="meta" color="secondary">
                Terlaris
              </Text>
              <Text variant="bodyStrong" numberOfLines={2}>
                {recap.topItems[0]?.name ?? '—'}
              </Text>
              <Text variant="tag" color="secondary">
                {recap.topItems[0] ? `${recap.topItems[0].totalQty}× terjual` : 'belum ada'}
              </Text>
            </Card>
          </View>

          <SectionLabel>Omzet 7 hari terakhir</SectionLabel>
          <Card>
            {daily ? (
              <View style={styles.chart}>
                {daily.map((d, i) => (
                  // Each column is one accessible node: a bare coloured View
                  // is invisible to a screen reader.
                  <View
                    key={i}
                    style={styles.chartCol}
                    accessible
                    accessibilityLabel={`${d.label}${d.isToday ? ' (hari ini)' : ''}, ${formatRupiah(
                      d.total
                    )}`}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.max((d.total / maxDaily) * 100, 3)}%` },
                      ]}
                    />
                    <Text variant="tag" color={d.isToday ? 'text' : 'secondary'}>
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <ActivityIndicator color={colors.primaryInk} />
            )}
          </Card>

          {recap.topItems.length > 1 && (
            <>
              <SectionLabel>Barang terlaris</SectionLabel>
              <Card padding="sm">
                {recap.topItems.map((item, idx) => (
                  <Row
                    key={item.name}
                    title={item.name}
                    value={`${item.totalQty}×`}
                    leading={
                      <Text variant="meta" color="secondary" align="center" style={styles.rank}>
                        {idx + 1}
                      </Text>
                    }
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// Screen-specific layout only — every surface and text style comes from the kit.
const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  periods: { marginTop: spacing.md },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  smallRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  smallCard: { flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 130 },
  chartCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
  },
  rank: { width: 22 },
});
