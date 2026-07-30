import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { RotatingGreeting } from '@/components/rotating-greeting';
import { ListState, Row, Screen, SectionLabel, Tag, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import { showLocalNotification, unreadCount } from '@/lib/notifications';
import { listRecentOrderStores, type RecentStore } from '@/lib/orders';
import { finalPrice, listDiscountedProducts, type DiscountedProduct } from '@/lib/products';
import { listNearbyStores, type NearbyStore } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, layout, radius, spacing } from '@/lib/theme';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}


export default function BuyerHome() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);
  const [deals, setDeals] = useState<DiscountedProduct[]>([]);
  const [again, setAgain] = useState<RecentStore[]>([]);
  const [unread, setUnread] = useState(0);
  const [denied, setDenied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PA-9/PA-3: while the app is open, a status change on any of my orders
  // fires a local notification (remote push needs a dev build).
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('buyer-order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${profile.id}`,
        },
        (payload) => {
          const s = (payload.new as { status?: string }).status;
          const label =
            s === 'accepted'
              ? 'Pesananmu diterima dan sedang disiapkan.'
              : s === 'ready'
                ? 'Pesananmu sudah siap!'
                : s === 'completed'
                  ? 'Pesanan selesai. Terima kasih!'
                  : s === 'rejected'
                    ? 'Maaf, pesananmu belum bisa diterima.'
                    : null;
          if (label) showLocalNotification('NgomongAja', label);
          // The inbox row is written by a database trigger; just refresh the badge.
          unreadCount().then(setUnread).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const loadNearby = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setDenied(true);
      setStores([]);
      return [] as NearbyStore[];
    }
    setDenied(false);
    const pos = await Location.getCurrentPositionAsync({});
    const nearby = await listNearbyStores(pos.coords.latitude, pos.coords.longitude);
    setStores(nearby);
    return nearby;
  }, []);

  // Neither of these needs the buyer's location, so they must not queue behind
  // the GPS fix — that can take seconds on a cold start, and the bell badge and
  // "Pesan lagi" rail can be on screen long before the warung list is.
  const loadLocationFree = useCallback(() => {
    unreadCount()
      .then(setUnread)
      .catch(() => {});

    if (profile) {
      listRecentOrderStores(profile.id)
        .then(setAgain)
        .catch((e) => console.warn('listRecentOrderStores:', e.message));
    }
  }, [profile]);

  // Discounts are scoped to the warungs actually near the buyer, so this one
  // genuinely has to wait for the nearby list.
  const loadDeals = useCallback((nearby: NearbyStore[]) => {
    listDiscountedProducts(nearby.map((s) => s.id))
      .then(setDeals)
      .catch((e) => console.warn('listDiscountedProducts:', e.message));
  }, []);

  const load = useCallback(() => {
    setLoadFailed(false);
    // Fired together, not chained: the rails are decoration around the warung
    // list, and a failing rail must never take the page down with it.
    loadLocationFree();
    loadNearby()
      .then(loadDeals)
      .catch((e) => {
        console.warn('loadNearby:', e.message);
        setLoadFailed(true);
        setStores([]);
      });
  }, [loadNearby, loadDeals, loadLocationFree]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      loadLocationFree();
      loadDeals(await loadNearby());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    setRefreshing(false);
  };

  const openStore = (id: string) =>
    router.push({ pathname: '/(buyer)/store/[id]', params: { id } });

  const header = (
    <View style={styles.header}>
      <RotatingGreeting name={profile?.full_name?.split(' ')[0]} />
      <Pressable
        onPress={() => router.push('/(buyer)/notifications')}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Pemberitahuan, ${unread} belum dibaca` : 'Pemberitahuan'
        }
        style={styles.bell}>
        <Feather name="bell" size={22} color={colors.text} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text variant="tag" color="onPrimary">
              {unread > 9 ? '9+' : String(unread)}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  if (!stores) {
    return (
      <Screen>
        {header}
        <ListState state="loading" message="Mencari warung di sekitarmu…" />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryInk}
          />
        }
        ListHeaderComponent={
          <View>
            <Pressable
              onPress={() => router.push('/(buyer)/search')}
              accessibilityRole="search"
              accessibilityLabel="Cari warung"
              style={styles.searchBox}>
              <Feather name="search" size={18} color={colors.secondary} />
              <Text variant="body" color="secondary">
                Cari warung…
              </Text>
            </Pressable>

            {deals.length > 0 && (
              <>
                <SectionLabel first>Lagi diskon</SectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}>
                  {deals.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => openStore(p.store_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, diskon ${p.discount_percent} persen, sekarang ${formatRupiah(finalPrice(p))}, di ${p.stores?.name ?? 'warung'}`}
                      style={styles.dealCard}>
                      <View style={styles.dealTop}>
                        <Tag tone="danger" label={`-${p.discount_percent}%`} />
                      </View>
                      <Text variant="bodyStrong" numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text variant="money" color="danger">
                        {formatRupiah(finalPrice(p))}
                      </Text>
                      {/* The struck-through original is backed up by the "-N%"
                          tag, so the saving is never carried by styling alone. */}
                      <Text variant="tag" color="secondary" style={styles.strike}>
                        {formatRupiah(p.price)}
                      </Text>
                      <Text variant="tag" color="secondary" numberOfLines={1}>
                        {p.stores?.name ?? ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {again.length > 0 && (
              <>
                <SectionLabel>Pesan lagi</SectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}>
                  {again.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => openStore(s.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pesan lagi di ${s.name}`}
                      style={styles.againCard}>
                      <View style={styles.againTile}>
                        <Feather name="rotate-ccw" size={18} color={colors.primaryInk} />
                      </View>
                      <Text variant="bodyStrong" numberOfLines={2}>
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <SectionLabel>Warung dekat kamu</SectionLabel>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            meta={`${formatDistance(item.distance_km)} · ongkir ${formatRupiah(item.delivery_fee)}`}
            onPress={() => openStore(item.id)}
            leading={
              <View style={styles.storeTile}>
                <Text variant="bodyStrong" color="primaryInk">
                  {item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            }
          />
        )}
        ListEmptyComponent={
          denied ? (
            <ListState
              state="empty"
              icon="map-pin"
              title="Kami belum tahu kamu di mana"
              message="Nyalakan izin lokasi supaya kami bisa tunjukkan warung terdekat."
              action={{ label: 'Buka Pengaturan', onPress: () => Linking.openSettings() }}
              secondaryAction={{ label: 'Coba Lagi', onPress: load }}
            />
          ) : loadFailed ? (
            <ListState
              state="error"
              message={friendlyError('load failed')}
              action={{ label: 'Coba Lagi', onPress: load }}
            />
          ) : (
            <ListState
              state="empty"
              icon="shopping-bag"
              title="Belum ada warung di dekatmu"
              message="Coba lagi nanti ya."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bell: {
    width: layout.minTouch,
    height: layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
  rail: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  dealCard: {
    width: 150,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  dealTop: { flexDirection: 'row' },
  strike: { textDecorationLine: 'line-through' },
  againCard: {
    width: 140,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  againTile: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
