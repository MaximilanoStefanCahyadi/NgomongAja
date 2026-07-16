import * as Location from 'expo-location';
import { Link, useFocusEffect } from 'expo-router';
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
import { colors, radius, screenWrap, spacing } from '@/lib/theme';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

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
          <Text style={styles.title}>Toko Terdekat</Text>
          <Text style={styles.subtitle}>Halo, {profile?.full_name} 👋</Text>
        </View>
        <Link href="/(buyer)/orders" asChild>
          <Pressable
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Pesanan saya">
            <Text style={styles.headerBtnText}>📋{'\n'}Pesanan</Text>
          </Pressable>
        </Link>
        <Link href="/(buyer)/profile" asChild>
          <Pressable
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Profil saya">
            <Text style={styles.headerBtnText}>👤{'\n'}Profil</Text>
          </Pressable>
        </Link>
      </View>

      {favorites.length > 0 && (
        <View style={styles.favSection}>
          <Text style={styles.favTitle}>⭐ Favoritmu</Text>
          <View style={styles.favRow}>
            {favorites.slice(0, 6).map((f) => (
              <Link
                key={f.id}
                href={{ pathname: '/(buyer)/store/[id]', params: { id: f.id } }}
                asChild>
                <Pressable style={styles.favChip} accessibilityRole="button">
                  <Text style={styles.favChipText} numberOfLines={1}>
                    {f.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      )}

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
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
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                🔍 Belum ada warung di dekatmu. Tarik layar ke bawah untuk cari lagi.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/(buyer)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDistance(item.distance_km)}`}>
              <View style={styles.storeBadge}>
                <Text style={styles.storeBadgeEmoji}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
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
  centerText: { color: colors.body },
  container: { ...screenWrap },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerBtnText: {
    fontSize: 12,
    color: colors.primaryDark,
    textAlign: 'center',
    fontWeight: '600',
  },
  favSection: { marginTop: spacing.md },
  favTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6, color: colors.text },
  favRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  favChip: {
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberSoftBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
  },
  favChipText: { fontSize: 13, fontWeight: '600', color: '#854d0e' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.body, marginTop: 2 },
  empty: { color: colors.body, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  emptyCard: {
    backgroundColor: colors.sunnyBg,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 32,
  },
  emptyCardText: { color: colors.sunnyText, textAlign: 'center', fontSize: 16, lineHeight: 22 },
  storeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryChipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeBadgeEmoji: { fontSize: 22 },
  cardPressed: { backgroundColor: colors.primarySoft },
  emptyBox: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: spacing.xs,
  },
  emptyButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  emptyOutlineButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyOutlineButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardDesc: { fontSize: 15, color: colors.body, marginTop: 2 },
  distance: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDeep,
    backgroundColor: colors.primaryChipBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
