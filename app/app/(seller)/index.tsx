import { Feather } from '@expo/vector-icons';
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
import { colors, fonts, radius, screenWrap } from '@/lib/theme';

const THUMB_BG = [colors.primaryChipBg, colors.amberBg, colors.neutralBg] as const;
const THUMB_FG = [colors.primaryDeep, colors.sunnyText, colors.body] as const;

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
      <Text style={styles.greeting}>Halo, {profile?.full_name} 👋</Text>
      <Text style={styles.title}>Toko Saya</Text>

      {pendingCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.pendingBanner, pressed && { opacity: 0.9 }]}
          onPress={openPendingOrders}
          accessibilityRole="button"
          accessibilityLabel={`${pendingCount} pesanan menunggu, ketuk untuk lihat`}
          accessibilityLiveRegion="polite">
          <View style={styles.bellCircle}>
            <Feather name="bell" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>
              {pendingCount} pesanan menunggu
            </Text>
            <Text style={styles.pendingSub}>Ketuk untuk konfirmasi sekarang</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#fff" />
        </Pressable>
      )}

      <Text style={styles.sectionLabel}>Toko kamu</Text>
      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              Belum ada toko. Yuk buat toko pertamamu!
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Link href={{ pathname: '/(seller)/store/[id]', params: { id: item.id } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button">
              <View style={[styles.thumb, { backgroundColor: THUMB_BG[index % 3] }]}>
                <Text style={[styles.thumbInitial, { color: THUMB_FG[index % 3] }]}>
                  {item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={1}>
                  {item.description || 'Ketuk untuk kelola toko'}
                </Text>
              </View>
              <Text style={[styles.tag, item.is_active ? styles.tagOpen : styles.tagClosed]}>
                {item.is_active ? 'Buka' : 'Tutup'}
              </Text>
            </Pressable>
          </Link>
        )}
      />

      <Link href="/(seller)/store/new" asChild>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: colors.primaryDark }]}
          accessibilityRole="button">
          <Feather name="plus" size={20} color={colors.onPrimary} />
          <Text style={styles.addButtonText}>Tambah Toko</Text>
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
  greeting: { fontFamily: fonts.body, fontSize: 14, color: colors.secondary },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.text, marginTop: 4 },
  pendingBanner: {
    marginTop: 20,
    backgroundColor: colors.amber,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bellCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: { fontFamily: fonts.heading, fontSize: 18, color: '#fff' },
  pendingSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,.9)',
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 12,
  },
  emptyCardText: {
    fontFamily: fonts.body,
    color: colors.sunnyText,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
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
  tag: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  tagOpen: { backgroundColor: colors.primarySoft, color: colors.primaryDeep },
  tagClosed: { backgroundColor: colors.amberBg, color: colors.sunnyText },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  addButtonText: { color: colors.onPrimary, fontSize: 17, fontFamily: fonts.heading },
  signOutWrap: { alignSelf: 'center', paddingVertical: 14 },
  signOut: { fontFamily: fonts.bodySemi, color: colors.sunnyText, fontSize: 14 },
});
