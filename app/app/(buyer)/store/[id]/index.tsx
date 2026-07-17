import { Feather } from '@expo/vector-icons';
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
import { colors, fonts, radius, screenWrap, spacing } from '@/lib/theme';

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

  const avgRating =
    reviews && reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
          .toFixed(1)
          .replace('.', ',')
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backWrap}
        accessibilityRole="button"
        accessibilityLabel="Kembali">
        <Feather name="chevron-left" size={18} color={colors.primaryDark} />
        <Text style={styles.back}>Toko Terdekat</Text>
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
          <Feather
            name="star"
            size={26}
            color={isFav ? colors.sunny : colors.secondary}
            style={isFav && { textShadowColor: colors.sunny }}
          />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        {avgRating ? (
          <View style={styles.metaItem}>
            <Feather name="star" size={13} color={colors.amberText} />
            <Text style={styles.metaRating}>
              {avgRating} · {reviews!.length} ulasan
            </Text>
          </View>
        ) : (
          <Text style={styles.metaMuted}>Belum ada ulasan</Text>
        )}
        {(store.gmaps_url || (store.lat && store.lng)) && (
          <>
            <Text style={styles.metaMuted}>·</Text>
            <Pressable onPress={openMaps} hitSlop={10} style={styles.metaItem}>
              <Feather name="map-pin" size={14} color={colors.primaryDark} />
              <Text style={styles.mapsLink}>Buka di Maps</Text>
            </Pressable>
          </>
        )}
      </View>
      {!!store.description && <Text style={styles.desc}>{store.description}</Text>}

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

      <Text style={styles.sectionLabel}>Daftar barang ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 9, paddingVertical: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              Penjual belum mengisi daftar barang. Coba Ngomong Aja aja!
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
              <Text style={styles.outOfStock}>Habis</Text>
            ) : cart[item.id] ? (
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepBtn, { backgroundColor: colors.neutralBg }]}
                  onPress={() => addToCart(item, -1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Kurangi ${item.name}`}>
                  <Text style={[styles.stepBtnText, { color: colors.body }]}>−</Text>
                </Pressable>
                <Text style={styles.stepQty}>{cart[item.id]}</Text>
                <Pressable
                  style={[styles.stepBtn, { backgroundColor: colors.primaryChipBg }]}
                  onPress={() => addToCart(item, 1)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tambah ${item.name}`}>
                  <Text style={[styles.stepBtnText, { color: colors.primaryDeep }]}>＋</Text>
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
        <Pressable
          style={({ pressed }) => [styles.cartBar, pressed && { backgroundColor: colors.neutralBg }]}
          onPress={checkoutCart}
          accessibilityRole="button">
          <Text style={styles.cartBarText}>
            {cartEntries.length} barang · {formatRupiah(cartTotal)}
          </Text>
          <Text style={styles.cartBarAction}>Lanjut ›</Text>
        </Pressable>
      )}

      {/* The heart of NgomongAja. */}
      <Pressable
        style={({ pressed }) => [styles.voiceButton, pressed && styles.voiceButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Pesan pakai suara"
        onPress={() =>
          router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: store.id } })
        }>
        <Feather name="mic" size={22} color={colors.onPrimary} />
        <Text style={styles.voiceButtonText}>Ngomong Aja</Text>
      </Pressable>
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
  errorText: { fontFamily: fonts.body, color: colors.body, fontSize: 15, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontFamily: fonts.heading },
  container: { ...screenWrap },
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRating: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.amberText },
  metaMuted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.secondary },
  mapsLink: { fontFamily: fonts.bodySemi, color: colors.primaryDark, fontSize: 13.5 },
  desc: { fontFamily: fonts.body, fontSize: 14, color: colors.body, marginTop: 6 },
  gallery: { marginTop: spacing.lg, flexGrow: 0 },
  galleryPhoto: {
    width: 118,
    height: 86,
    borderRadius: radius.md,
    backgroundColor: colors.neutralBg,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 22,
  },
  emptyCard: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.lg,
    padding: 20,
    marginVertical: 8,
  },
  emptyCardText: {
    fontFamily: fonts.body,
    color: colors.sunnyText,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  productName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  productPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.primaryDark,
    marginTop: 2,
  },
  outOfStock: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.sunnyText,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  stepQty: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    minWidth: 20,
    textAlign: 'center',
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primaryChipBg,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: { color: colors.primaryDeep, fontSize: 13.5, fontFamily: fonts.heading },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: spacing.sm,
  },
  cartBarText: { fontFamily: fonts.heading, fontSize: 15, color: colors.primaryDeep },
  cartBarAction: { fontFamily: fonts.heading, fontSize: 15, color: colors.primary },
  voiceButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  voiceButtonPressed: { backgroundColor: colors.primaryDark },
  voiceButtonText: { color: colors.onPrimary, fontSize: 19, fontFamily: fonts.heading },
});
