import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import {
  Card,
  IconButton,
  ListState,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  Text,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { showLocalNotification } from '@/lib/notifications';
import { listNearbyStores, type NearbyStore } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, elevation, radius, spacing } from '@/lib/theme';

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

export default function BuyerHome() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);
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

  const nearest = stores?.[0];

  // The hero banner starts a voice order at the NEAREST warung.
  const startVoiceOrder = () => {
    if (!nearest) return;
    router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: nearest.id } });
  };

  if (!stores) {
    return (
      <Screen centered>
        <ListState state="loading" message="Mencari warung di sekitarmu…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Toko Terdekat"
        subtitle={profile?.full_name ? `Halo, ${profile.full_name}` : undefined}
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon="clipboard"
              accessibilityLabel="Pesanan saya"
              onPress={() => router.push('/(buyer)/orders')}
            />
            <IconButton
              icon="user"
              accessibilityLabel="Profil saya"
              onPress={() => router.push('/(buyer)/profile')}
            />
          </View>
        }
      />

      {nearest && (
        <Pressable
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
          onPress={startVoiceOrder}
          accessibilityRole="button"
          accessibilityLabel={`Pesan pakai suara di ${nearest.name}`}>
          <View style={styles.heroMic}>
            <Feather name="mic" size={24} color={colors.onPrimary} />
          </View>
          <View style={styles.heroText}>
            <Text variant="title" color="onPrimary">
              Ngomong Aja
            </Text>
            {/* Name the target warung — the old copy said "cukup bicara" and
                silently ordered from whichever store happened to be first. */}
            <Text variant="meta" color="onPrimarySoft" numberOfLines={1}>
              Pesan di {nearest.name}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.onPrimarySoft} />
        </Pressable>
      )}

      <SectionLabel>Pilih warung</SectionLabel>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loadFailed ? (
            <ListState
              state="error"
              title="Gagal memuat"
              message="Periksa koneksi internetmu, lalu coba lagi."
              action={{ label: 'Coba Lagi', onPress: load }}
            />
          ) : denied ? (
            <ListState
              state="empty"
              icon="map-pin"
              title="Izin lokasi dimatikan"
              message="Aktifkan izin lokasi supaya kami bisa mencari warung di dekatmu."
              action={{ label: 'Buka Pengaturan', onPress: () => Linking.openSettings() }}
              secondaryAction={{ label: 'Coba Lagi', onPress: load }}
            />
          ) : (
            <ListState
              state="empty"
              icon="map-pin"
              title="Belum ada warung di dekatmu"
              message="Tarik layar ke bawah untuk mencari lagi."
            />
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({ pathname: '/(buyer)/store/[id]', params: { id: item.id } })
            }
            padding="sm"
            accessibilityLabel={`${item.name}, ${formatDistance(item.distance_km)}`}>
            <Row
              title={item.name}
              meta={item.description || undefined}
              leading={
                // One neutral thumbnail treatment. The old code rotated
                // green/orange/neutral by row index, which made green stop
                // meaning "good" anywhere else on the screen.
                <View style={styles.thumb}>
                  <Text variant="title" color="body">
                    {item.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
              trailing={
                <Text variant="meta" color="secondary">
                  {formatDistance(item.distance_km)}
                </Text>
              }
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  hero: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...elevation.none,
  },
  heroPressed: { backgroundColor: colors.primaryDark },
  heroMic: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.xs,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
