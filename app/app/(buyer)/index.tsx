import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { listFavoriteStores } from '@/lib/favorites';
import { showLocalNotification } from '@/lib/notifications';
import { listNearbyStores, type NearbyStore, type Store } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, screenWrap, spacing } from '@/lib/theme';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

// Striped-placeholder thumbnail colors rotate per row (like the design's
// decorative photo blocks): green, orange, warm neutral.
const THUMB_BG = [colors.primaryChipBg, colors.amberBg, colors.neutralBg] as const;
const THUMB_FG = [colors.primaryDeep, colors.sunnyText, colors.body] as const;

export default function BuyerHome() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);
  const [favorites, setFavorites] = useState<Store[]>([]);
  const [denied, setDenied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PA-4: favorite warung, one tap away regardless of distance.
  // useFocusEffect so favoriting/unfavoriting on a store page reflects here on return.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      listFavoriteStores(profile.id).then(setFavorites).catch(() => {});
    }, [profile])
  );

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
              ? 'Pesananmu diterima dan sedang disiapkan 👍'
              : s === 'ready'
                ? 'Pesananmu sudah siap! 📦'
                : s === 'completed'
                  ? 'Pesanan selesai. Terima kasih! 🙏'
                  : s === 'rejected'
                    ? 'Maaf, pesananmu ditolak penjual.'
                    : null;
          if (label) showLocalNotification('NgomongAja', label);
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
      return;
    }
    setDenied(false);
    const pos = await Location.getCurrentPositionAsync({});
    const nearby = await listNearbyStores(pos.coords.latitude, pos.coords.longitude);
    setStores(nearby);
  }, []);

  const load = useCallback(() => {
    setLoadFailed(false);
    loadNearby().catch((e) => {
      console.warn('loadNearby:', e.message);
      setLoadFailed(true);
      setStores([]);
    });
  }, [loadNearby]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadFailed(false);
    await loadNearby().catch(() => setLoadFailed(true));
    setRefreshing(false);
  };

  // The hero banner starts a voice order at the NEAREST warung.
  const startVoiceOrder = () => {
    if (!stores || stores.length === 0) return;
    router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: stores[0].id } });
  };

  if (!stores) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Mencari warung di sekitarmu…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Halo, {profile?.full_name} 👋</Text>
          <Text style={styles.title}>Toko Terdekat</Text>
        </View>
        <Link href="/(buyer)/orders" asChild>
          <Pressable
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Pesanan saya">
            <Feather name="clipboard" size={21} color={colors.text} />
          </Pressable>
        </Link>
        <Link href="/(buyer)/profile" asChild>
          <Pressable
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Profil saya">
            <Feather name="user" size={21} color={colors.text} />
          </Pressable>
        </Link>
      </View>

      {stores.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
          onPress={startVoiceOrder}
          accessibilityRole="button"
          accessibilityLabel="Pesan pakai suara di warung terdekat">
          <View style={styles.heroMic}>
            <Feather name="mic" size={27} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Ngomong Aja</Text>
            <Text style={styles.heroSub}>Pesan cukup dengan bicara</Text>
          </View>
        </Pressable>
      )}

      {favorites.length > 0 && (
        <View style={styles.favSection}>
          <Text style={styles.sectionLabel}>Favoritmu</Text>
          <View style={styles.favRow}>
            {favorites.slice(0, 6).map((f) => (
              <Link
                key={f.id}
                href={{ pathname: '/(buyer)/store/[id]', params: { id: f.id } }}
                asChild>
                <Pressable style={styles.favChip} accessibilityRole="button">
                  <Feather name="star" size={12} color={colors.sunnyText} />
                  <Text style={styles.favChipText} numberOfLines={1}>
                    {f.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Pilih warung</Text>
      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loadFailed ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>Gagal memuat. Periksa internetmu.</Text>
              <Pressable style={styles.emptyButton} onPress={load} accessibilityRole="button">
                <Text style={styles.emptyButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : denied ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan supaya kami bisa
                mencari warung di dekatmu.
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => Linking.openSettings()}
                accessibilityRole="button">
                <Text style={styles.emptyButtonText}>Buka Pengaturan</Text>
              </Pressable>
              <Pressable
                style={styles.emptyOutlineButton}
                onPress={load}
                accessibilityRole="button">
                <Text style={styles.emptyOutlineButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                Belum ada warung di dekatmu. Tarik layar ke bawah untuk cari lagi.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Link href={{ pathname: '/(buyer)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDistance(item.distance_km)}`}>
              <View style={[styles.thumb, { backgroundColor: THUMB_BG[index % 3] }]}>
                <Text style={[styles.thumbInitial, { color: THUMB_FG[index % 3] }]}>
                  {item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={styles.distance}>{formatDistance(item.distance_km)}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
  },
  centerText: { fontFamily: fonts.body, color: colors.body },
  container: { ...screenWrap },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  greeting: { fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.text, marginTop: 4 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  hero: {
    marginTop: 22,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  heroPressed: { backgroundColor: colors.primaryDark },
  heroMic: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.onPrimary },
  heroSub: { fontFamily: fonts.body, fontSize: 13.5, color: '#eef2e4', marginTop: 2 },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 26,
  },
  favSection: { gap: 8 },
  favRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 8 },
  favChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amberBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 170,
  },
  favChipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.sunnyText },
  empty: {
    fontFamily: fonts.body,
    color: colors.body,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
    fontSize: 14.5,
  },
  emptyBox: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 26,
    marginTop: spacing.xs,
  },
  emptyButtonText: { color: colors.onPrimary, fontSize: 15, fontFamily: fonts.heading },
  emptyOutlineButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  emptyOutlineButtonText: { color: colors.body, fontSize: 15, fontFamily: fonts.heading },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  cardPressed: { backgroundColor: colors.neutralBg },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: { fontFamily: fonts.heading, fontSize: 22 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.secondary,
    marginTop: 2,
  },
  distance: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.primaryDeep,
    backgroundColor: colors.primaryChipBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
