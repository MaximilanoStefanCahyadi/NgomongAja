import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ListState,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
  Tag,
  Text,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { showLocalNotification } from '@/lib/notifications';
import { countPendingForOwner, expireStaleOrders } from '@/lib/orders';
import { listMyStores, type Store } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { colors, layout, radius, spacing } from '@/lib/theme';

export default function SellerHome() {
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        showLocalNotification('Pesanan baru', 'Ada pesanan baru masuk — cek tokomu!');
        countPendingForOwner(profile.id).then(setPendingCount).catch(() => {});
      })
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
      <Screen centered>
        <ListState state="loading" message="Memuat tokomu…" />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label="Tambah Toko"
          icon="plus"
          onPress={() => router.push('/(seller)/store/new')}
        />
      }>
      <ScreenHeader
        title="Toko Saya"
        subtitle={profile?.full_name ? `Halo, ${profile.full_name}` : undefined}
      />

      {pendingCount > 0 && (
        // "Needs attention" is a warn TINT with a left rule — not a solid
        // amber slab with a shadow. One signal, and the text stays at 6.83:1.
        <Card
          tone="warn"
          row
          onPress={openPendingOrders}
          style={styles.pending}
          accessibilityLabel={`${pendingCount} pesanan menunggu, ketuk untuk lihat`}>
          <View style={styles.bell}>
            <Feather name="bell" size={20} color={colors.warnInk} />
          </View>
          <View style={styles.pendingText}>
            <Text variant="bodyStrong" color="warn" accessibilityLiveRegion="polite">
              {pendingCount} pesanan menunggu
            </Text>
            <Text variant="meta" color="warn">
              Ketuk untuk konfirmasi sekarang
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.warnInk} />
        </Card>
      )}

      <SectionLabel>Toko kamu</SectionLabel>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ListState
            state="empty"
            icon="shopping-bag"
            title="Belum ada toko"
            message="Yuk buat toko pertamamu — cuma butuh nama dan lokasi."
          />
        }
        renderItem={({ item }) => (
          <Card
            padding="sm"
            onPress={() =>
              router.push({ pathname: '/(seller)/store/[id]', params: { id: item.id } })
            }>
            <Row
              title={item.name}
              meta={item.description || 'Ketuk untuk kelola toko'}
              leading={
                <View style={styles.thumb}>
                  <Text variant="title" color="body">
                    {item.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              }
              trailing={
                <Tag
                  label={item.is_active ? 'Buka' : 'Tutup'}
                  tone={item.is_active ? 'success' : 'neutral'}
                />
              }
            />
          </Card>
        )}
      />

      <Pressable
        onPress={confirmSignOut}
        style={styles.signOut}
        accessibilityRole="button"
        accessibilityLabel="Keluar dari akun">
        <Text variant="label" color="danger" align="center">
          Keluar
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { marginTop: spacing.lg },
  pendingText: { flex: 1, gap: 2 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(122,69,16,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.xs,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    alignSelf: 'center',
    minHeight: layout.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
