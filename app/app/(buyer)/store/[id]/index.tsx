import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { listFavoriteStoreIds, toggleFavorite } from '@/lib/favorites';
import { formatRupiah } from '@/lib/format';
import type { MatchResult } from '@/lib/matching';
import { setOrderDraft } from '@/lib/order-draft';
import { listActiveProducts, type Product } from '@/lib/products';
import { listStoreReviews, type StoreReview } from '@/lib/reviews';
import { listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, type Store } from '@/lib/stores';
import { colors, radius, screenWrap, spacing } from '@/lib/theme';

export default function BuyerStorePage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [reviews, setReviews] = useState<StoreReview[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isFav, setIsFav] = useState(false);
  // PA-6: manual cart — productId -> quantity.
  const [cart, setCart] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    if (!id) return;
    setLoadFailed(false);
    // Store + products are essential; photos/reviews are decorative.
    Promise.all([getStore(id), listActiveProducts(id)])
      .then(([s, p]) => {
        setStore(s);
        setProducts(p);
      })
      .catch((e) => {
        console.warn('load store:', e.message);
        setLoadFailed(true);
      });
    listStorePhotos(id)
      .then(setPhotos)
      .catch((e) => console.warn('listStorePhotos:', e.message));
    listStoreReviews(id)
      .then(setReviews)
      .catch((e) => console.warn('listStoreReviews:', e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !profile) return;
    listFavoriteStoreIds(profile.id)
      .then((ids) => setIsFav(ids.has(id)))
      .catch(() => {});
  }, [id, profile]);

  const onToggleFav = async () => {
    if (!profile || !store) return;
    setIsFav(!isFav); // optimistic
    try {
      await toggleFavorite(profile.id, store.id, isFav);
    } catch {
      setIsFav(isFav); // roll back
    }
  };

  const addToCart = (p: Product, delta: number) =>
    setCart((c) => {
      const next = Math.max(0, (c[p.id] ?? 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[p.id];
      else copy[p.id] = Math.min(next, p.stock);
      return copy;
    });

  const cartEntries = products
    ? products.filter((p) => cart[p.id]).map((p) => ({ product: p, quantity: cart[p.id] }))
    : [];
  const cartTotal = cartEntries.reduce((s, e) => s + e.product.price * e.quantity, 0);

  // PA-6: the manual cart rides the same review/checkout flow as voice orders —
  // each cart line becomes an already-"matched" result.
  const checkoutCart = () => {
    if (!store || cartEntries.length === 0) return;
    const results: MatchResult[] = cartEntries.map((e) => ({
      kind: 'matched',
      item: { name: e.product.name, quantity: e.quantity, unit: 'pcs' },
      product: e.product,
    }));
    setOrderDraft({
      storeId: store.id,
      transcript: 'Pesanan manual (pilih dari daftar barang)',
      audioUri: null,
      results,
    });
    router.push({ pathname: '/(buyer)/store/[id]/review', params: { id: store.id } });
  };

  const openMaps = () => {
    if (!store) return;
    // Prefer the seller's own Maps link; otherwise build one from coordinates.
    const url =
      store.gmaps_url ||
      `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
    Linking.openURL(url).catch(() => {});
  };

  if (loadFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Gagal memuat. Periksa internetmu.</Text>
        <Pressable style={styles.button} onPress={load} accessibilityRole="button">
          <Text style={styles.buttonText}>Coba Lagi</Text>
        </Pressable>
      </View>
    );
  }

  if (!store || !products) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
        <Text style={styles.back}>‹ Toko Terdekat</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
          {store.name}
        </Text>
        <Pressable
          onPress={onToggleFav}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}>
          <Text style={styles.favStar}>{isFav ? '⭐' : '☆'}</Text>
        </Pressable>
      </View>
      {!!store.description && <Text style={styles.desc}>{store.description}</Text>}
      {(store.gmaps_url || (store.lat && store.lng)) && (
        <Pressable onPress={openMaps} hitSlop={12} style={styles.mapsWrap}>
          <Text style={styles.mapsLink}>📍 Buka di Google Maps</Text>
        </Pressable>
      )}

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
          contentContainerStyle={{ gap: 8 }}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: p.image_url }} style={styles.galleryPhoto} />
          ))}
        </ScrollView>
      )}

      <Text style={styles.sectionTitle}>Daftar Barang ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              📦 Penjual belum mengisi daftar barang. Coba Ngomong Aja aja!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.productRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>{formatRupiah(item.price)}</Text>
            </View>
            {item.stock === 0 ? (
              <Text style={[styles.stockBadge, styles.outOfStock]}>Habis</Text>
            ) : cart[item.id] ? (
              <View style={styles.cartControls}>
                <Pressable
                  style={styles.cartBtn}
                  onPress={() => addToCart(item, -1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Kurangi ${item.name}`}>
                  <Text style={styles.cartBtnText}>−</Text>
                </Pressable>
                <Text style={styles.cartQty}>{cart[item.id]}</Text>
                <Pressable
                  style={styles.cartBtn}
                  onPress={() => addToCart(item, 1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tambah ${item.name}`}>
                  <Text style={styles.cartBtnText}>＋</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.addBtn}
                onPress={() => addToCart(item, 1)}
                accessibilityRole="button"
                accessibilityLabel={`Tambah ${item.name} ke keranjang`}>
                <Text style={styles.addBtnText}>＋ Tambah</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      {cartEntries.length > 0 && (
        <Pressable style={styles.cartBar} onPress={checkoutCart} accessibilityRole="button">
          <Text style={styles.cartBarText}>
            🛒 {cartEntries.length} barang · {formatRupiah(cartTotal)}
          </Text>
          <Text style={styles.cartBarAction}>Lanjut ›</Text>
        </Pressable>
      )}

      <View style={styles.reviewsSection}>
        <Text style={styles.sectionTitle}>Ulasan</Text>
        {!reviews || reviews.length === 0 ? (
          <Text style={styles.noReviews}>⭐ Belum ada ulasan — jadilah yang pertama!</Text>
        ) : (
          <>
            <Text style={styles.ratingHeadline}>
              ★{' '}
              {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
                .toFixed(1)
                .replace('.', ',')}{' '}
              · {reviews.length} ulasan
            </Text>
            {reviews
              .filter((r) => !!r.comment)
              .slice(0, 3)
              .map((r, i) => (
                <Text key={i} style={styles.reviewComment} numberOfLines={2}>
                  {'★'.repeat(r.rating)} "{r.comment}"
                </Text>
              ))}
          </>
        )}
      </View>

      {/* The heart of NgomongAja. */}
      <Pressable
        style={({ pressed }) => [styles.voiceButton, pressed && styles.voiceButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Pesan pakai suara"
        onPress={() =>
          router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: store.id } })
        }>
        <Text style={styles.voiceButtonText}>🎤 Ngomong Aja</Text>
      </Pressable>
      <Text style={styles.voiceHelper}>✨ Pesan cukup dengan bicara</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  errorText: { color: colors.body, fontSize: 15, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  container: { ...screenWrap },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  favStar: { fontSize: 30 },
  emptyCard: {
    backgroundColor: colors.sunnyBg,
    borderRadius: radius.lg,
    padding: 20,
    marginVertical: 8,
  },
  emptyCardText: { color: colors.sunnyText, textAlign: 'center', fontSize: 16, lineHeight: 22 },
  cartControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnText: { fontSize: 18, color: colors.primaryDark, fontWeight: 'bold' },
  cartQty: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addBtnText: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: spacing.sm,
  },
  cartBarText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  cartBarAction: { fontSize: 15, fontWeight: 'bold', color: colors.primary },
  desc: { fontSize: 14, color: colors.body, marginTop: 4 },
  mapsWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  mapsLink: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  gallery: { marginTop: spacing.md, flexGrow: 0 },
  galleryPhoto: {
    width: 120,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
  },
  reviewsSection: { gap: 4, marginBottom: spacing.md },
  ratingHeadline: { fontSize: 15, fontWeight: '600', color: colors.amber, marginTop: 2 },
  noReviews: { fontSize: 13, color: colors.body, marginTop: 2 },
  reviewComment: { fontSize: 13, color: colors.body, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, color: colors.text },
  empty: { color: colors.body, textAlign: 'center', marginTop: 24 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  productName: { fontSize: 15, fontWeight: '500', color: colors.text },
  productPrice: {
    fontSize: 14,
    color: colors.primaryDark,
    marginTop: 2,
    fontWeight: '600',
  },
  stockBadge: {
    fontSize: 12,
    color: colors.secondary,
    backgroundColor: colors.neutralBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  outOfStock: {
    color: colors.dangerDark,
    backgroundColor: colors.dangerBg,
    fontWeight: '600',
  },
  voiceButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.sunny,
  },
  voiceButtonPressed: {
    backgroundColor: colors.primaryDark,
    borderBottomWidth: 0,
    transform: [{ scale: 0.98 }],
  },
  voiceButtonText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  voiceHelper: {
    textAlign: 'center',
    color: colors.secondary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
});
