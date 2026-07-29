import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

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
import { formatRupiah } from '@/lib/format';
import { listActiveProducts, type Product } from '@/lib/products';
import { listStoreReviews, type StoreReview } from '@/lib/reviews';
import { listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, type Store } from '@/lib/stores';
import { colors, layout, radius, spacing } from '@/lib/theme';

export default function BuyerStorePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [reviews, setReviews] = useState<StoreReview[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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
      <Screen centered>
        <ListState
          state="error"
          title="Gagal memuat"
          message="Periksa internetmu, lalu coba lagi."
          action={{ label: 'Coba Lagi', onPress: load }}
        />
      </Screen>
    );
  }

  if (!store || !products) {
    return (
      <Screen centered>
        <ListState state="loading" message="Memuat toko…" />
      </Screen>
    );
  }

  const avgRating =
    reviews && reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
          .toFixed(1)
          .replace('.', ',')
      : null;

  // Kept as a real boolean: `store.lat && store.lng` yields the number 0 for a
  // store sitting on the equator/prime meridian, which React would try to
  // render as bare text.
  const hasMapLink = !!store.gmaps_url || (store.lat != null && store.lng != null);

  return (
    <Screen
      footer={
        // The heart of NgomongAja.
        <Button
          label="Ngomong Aja"
          icon="mic"
          accessibilityLabel="Pesan pakai suara"
          onPress={() =>
            router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: store.id } })
          }
        />
      }>
      <ScreenHeader title={store.name} backLabel="Toko Terdekat" />

      <View style={styles.metaRow}>
        {avgRating ? (
          <View style={styles.metaItem}>
            <Feather name="star" size={14} color={colors.secondary} />
            <Text variant="meta" color="secondary">
              {avgRating} · {reviews!.length} ulasan
            </Text>
          </View>
        ) : (
          <Text variant="meta" color="secondary">
            Belum ada ulasan
          </Text>
        )}
        {hasMapLink && (
          <Pressable
            onPress={openMaps}
            style={styles.mapsLink}
            accessibilityRole="link"
            accessibilityLabel="Buka lokasi toko di Google Maps">
            {/* A real link — Biru percaya, not the CTA orange. */}
            <Feather name="map-pin" size={14} color={colors.link} />
            <Text variant="label" color="link">
              Buka di Maps
            </Text>
          </Pressable>
        )}
      </View>

      {!!store.description && (
        <Text variant="body" color="body">
          {store.description}
        </Text>
      )}

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
          contentContainerStyle={styles.galleryContent}>
          {photos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.image_url }}
              style={styles.galleryPhoto}
              accessibilityLabel={`Foto ${store.name}`}
            />
          ))}
        </ScrollView>
      )}

      <SectionLabel>{`Daftar barang (${products.length})`}</SectionLabel>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ListState
            state="empty"
            icon="shopping-bag"
            title="Belum ada daftar barang"
            message="Penjual belum mengisi daftar barang. Coba Ngomong Aja aja!"
          />
        }
        renderItem={({ item }) => (
          <Card padding="sm">
            <Row
              title={item.name}
              trailing={
                <View style={styles.productTrailing}>
                  <Text variant="money" color="text">
                    {formatRupiah(item.price)}
                  </Text>
                  {item.stock === 0 ? (
                    <Tag label="Habis" tone="warn" />
                  ) : (
                    <Tag label={`stok ${item.stock}`} tone="neutral" />
                  )}
                </View>
              }
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // Real padding instead of hitSlop: the touch target and the visible
  // affordance are now the same rectangle.
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouch,
    paddingRight: spacing.sm,
  },
  gallery: { marginTop: spacing.lg, flexGrow: 0 },
  galleryContent: { gap: spacing.sm },
  galleryPhoto: {
    width: 118,
    height: 86,
    borderRadius: radius.md,
    backgroundColor: colors.neutralBg,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  productTrailing: { alignItems: 'flex-end', gap: spacing.xs },
});
