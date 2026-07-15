import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { formatRupiah } from '@/lib/format';
import { listActiveProducts, type Product } from '@/lib/products';
import { listStoreReviews, type StoreReview } from '@/lib/reviews';
import { listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, type Store } from '@/lib/stores';

export default function BuyerStorePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [reviews, setReviews] = useState<StoreReview[] | null>(null);

  useEffect(() => {
    if (!id) return;
    getStore(id).then(setStore).catch((e) => console.warn('getStore:', e.message));
    listActiveProducts(id)
      .then(setProducts)
      .catch((e) => console.warn('listActiveProducts:', e.message));
    listStorePhotos(id)
      .then(setPhotos)
      .catch((e) => console.warn('listStorePhotos:', e.message));
    listStoreReviews(id)
      .then(setReviews)
      .catch((e) => console.warn('listStoreReviews:', e.message));
  }, [id]);

  const openMaps = () => {
    if (!store) return;
    // Prefer the seller's own Maps link; otherwise build one from coordinates.
    const url =
      store.gmaps_url ||
      `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
    Linking.openURL(url).catch(() => {});
  };

  if (!store || !products) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Toko Terdekat</Text>
      </Pressable>

      <Text style={styles.title}>{store.name}</Text>
      {!!store.description && <Text style={styles.desc}>{store.description}</Text>}
      {(store.gmaps_url || (store.lat && store.lng)) && (
        <Pressable onPress={openMaps}>
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
          <Text style={styles.empty}>Penjual belum mengisi daftar barang.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.productRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>{formatRupiah(item.price)}</Text>
            </View>
            <Text style={[styles.stockBadge, item.stock === 0 && styles.outOfStock]}>
              {item.stock === 0 ? 'Habis' : `stok ${item.stock}`}
            </Text>
          </View>
        )}
      />

      <View style={styles.reviewsSection}>
        <Text style={styles.sectionTitle}>Ulasan</Text>
        {!reviews || reviews.length === 0 ? (
          <Text style={styles.noReviews}>Belum ada ulasan</Text>
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
        style={styles.voiceButton}
        onPress={() =>
          router.push({ pathname: '/(buyer)/store/[id]/order', params: { id: store.id } })
        }>
        <Text style={styles.voiceButtonText}>🎤 Ngomong Aja</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 64 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold' },
  desc: { fontSize: 14, color: '#666', marginTop: 4 },
  mapsLink: { color: '#2563eb', fontSize: 14, marginTop: 8 },
  gallery: { marginTop: 12, flexGrow: 0 },
  galleryPhoto: { width: 120, height: 90, borderRadius: 8, backgroundColor: '#f3f4f6' },
  reviewsSection: { gap: 4, marginBottom: 12 },
  ratingHeadline: { fontSize: 15, fontWeight: '600', color: '#f59e0b', marginTop: 2 },
  noReviews: { fontSize: 13, color: '#666', marginTop: 2 },
  reviewComment: { fontSize: 13, color: '#555', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 12,
  },
  productName: { fontSize: 15, fontWeight: '500' },
  productPrice: { fontSize: 14, color: '#15803d', marginTop: 2, fontWeight: '600' },
  stockBadge: {
    fontSize: 12,
    color: '#555',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  outOfStock: { color: '#b91c1c', backgroundColor: '#fee2e2', fontWeight: '600' },
  voiceButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  voiceButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
