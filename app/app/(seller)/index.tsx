import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { showLocalNotification } from '@/lib/notifications';
import { countPendingForOwner, expireStaleOrders } from '@/lib/orders';
import { listMyStores, type Store } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, radius, screenWrap, spacing } from '@/lib/theme';

export default function SellerHome() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [stores, setStores] = useState<Store[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // useFocusEffect re-runs every time this screen comes back into view,
  // so a store created on the next screen appears here without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      listMyStores(profile.id)
        .then(setStores)
        .catch((e) => console.warn('listMyStores:', e.message));
      // Global pending badge across ALL stores (PRD S-1) — a pending order at
      // the other warung must never rot invisibly.
      expireStaleOrders()
        .then(() => countPendingForOwner(profile.id))
        .then(setPendingCount)
        .catch(() => {});
    }, [profile])
  );

  // PA-9/PA-3: while the app is open, a brand-new order at any of my stores
  // rings immediately (RLS scopes the subscription to my stores' orders).
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('seller-new-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          showLocalNotification('Pesanan baru 🛒', 'Ada pesanan baru masuk — cek tokomu!');
          countPendingForOwner(profile.id).then(setPendingCount).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Tapping the banner jumps straight to the order log — one store, one tap.
  const openPendingOrders = () => {
    if (!stores || stores.length === 0) return;
    router.push({
      pathname: '/(seller)/store/[id]/orders',
      params: { id: stores[0].id },
    });
  };

  const confirmSignOut = () => {
    Alert.alert('Keluar dari akun?', 'Kamu perlu masuk lagi untuk mengelola toko.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, keluar', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!stores) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Toko Saya 🏪</Text>
      <Text style={styles.subtitle}>Halo, {profile?.full_name} 👋</Text>
      {pendingCount > 0 && (
        <Pressable
          style={styles.pendingBanner}
          onPress={openPendingOrders}
          accessibilityRole="button"
          accessibilityLabel={`${pendingCount} pesanan menunggu, ketuk untuk lihat`}>
          <Text style={styles.pendingBannerText}>
            🔔 {pendingCount} pesanan baru menunggu — ketuk untuk lihat
          </Text>
        </Pressable>
      )}

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              🏪 Belum ada toko. Yuk buat toko pertamamu!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/(seller)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button">
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
              <Text style={[styles.badge, item.is_active ? styles.open : styles.closed]}>
                {item.is_active ? '🟢 Buka' : '🔴 Tutup'}
              </Text>
            </Pressable>
          </Link>
        )}
      />

      <Link href="/(seller)/store/new" asChild>
        <Pressable style={styles.addButton} accessibilityRole="button">
          <Text style={styles.addButtonText}>+ Tambah Toko</Text>
        </Pressable>
      </Link>

      <Pressable
        onPress={confirmSignOut}
        hitSlop={12}
        style={styles.signOutWrap}
        accessibilityRole="button">
        <Text style={styles.signOut}>Keluar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { ...screenWrap },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.body, marginTop: 2 },
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
  pendingBanner: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  pendingBannerText: { color: colors.amberText, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.body, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardDesc: { fontSize: 15, color: colors.body, marginTop: 2 },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  open: { backgroundColor: colors.primaryChipBg, color: colors.primaryDark },
  closed: { backgroundColor: colors.dangerBg, color: colors.dangerDark },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  addButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  signOutWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: spacing.md },
  signOut: { textAlign: 'center', color: colors.danger, fontSize: 14 },
});
