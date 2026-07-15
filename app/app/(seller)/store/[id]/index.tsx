import * as ImagePicker from 'expo-image-picker';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { formatRupiah } from '@/lib/format';
import { listProducts, type Product } from '@/lib/products';
import { addStorePhoto, listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, setStoreActive, type Store } from '@/lib/stores';

export default function StoreInventory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getStore(id).then(setStore).catch((e) => console.warn('getStore:', e.message));
      listProducts(id).then(setProducts).catch((e) => console.warn('listProducts:', e.message));
      listStorePhotos(id).then(setPhotos).catch((e) => console.warn('listStorePhotos:', e.message));
    }, [id])
  );

  const pickPhoto = async () => {
    if (!store || !profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      await addStorePhoto(profile.id, store.id, result.assets[0].uri);
      setPhotos(await listStorePhotos(store.id));
    } catch (e: any) {
      Alert.alert('Gagal mengunggah foto', e.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleOpen = async (value: boolean) => {
    if (!store) return;
    setStore({ ...store, is_active: value }); // optimistic: update UI first
    try {
      await setStoreActive(store.id, value);
    } catch (e: any) {
      setStore({ ...store, is_active: !value }); // roll back on failure
      Alert.alert('Gagal', e.message);
    }
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
        <Text style={styles.back}>‹ Toko Saya</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {store.name}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{store.is_active ? 'Buka' : 'Tutup'}</Text>
          <Switch value={store.is_active} onValueChange={toggleOpen} />
        </View>
      </View>

      <View style={styles.navRow}>
        <Link
          href={{ pathname: '/(seller)/store/[id]/orders', params: { id: store.id } }}
          asChild>
          <Pressable style={styles.navButton}>
            <Text style={styles.navButtonText}>📋 Pesanan</Text>
          </Pressable>
        </Link>
        <Link
          href={{ pathname: '/(seller)/store/[id]/recap', params: { id: store.id } }}
          asChild>
          <Pressable style={styles.navButton}>
            <Text style={styles.navButtonText}>📊 Rekap</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.sectionTitle}>Foto Toko</Text>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: p.image_url }} style={styles.photo} />
          ))}
          <Pressable style={styles.addPhoto} onPress={pickPhoto} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#16a34a" />
            ) : (
              <Text style={styles.addPhotoText}>＋ Tambah{'\n'}Foto</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>

      <Text style={styles.sectionTitle}>Barang ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Belum ada barang. Tekan "+ Tambah Barang" — mode cepatnya dibuat untuk
            memasukkan banyak barang berturut-turut.
          </Text>
        }
        renderItem={({ item }) => (
          <Link
            href={{
              pathname: '/(seller)/store/[id]/product',
              params: { id: store.id, productId: item.id },
            }}
            asChild>
            <Pressable style={styles.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.productName, !item.is_active && styles.inactive]}>
                  {item.name}
                </Text>
                <Text style={styles.productMeta}>
                  {formatRupiah(item.price)} · stok {item.stock}
                  {!item.is_active && ' · disembunyikan'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        )}
      />

      <Link
        href={{ pathname: '/(seller)/store/[id]/product', params: { id: store.id } }}
        asChild>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Tambah Barang</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 64 },
  back: { color: '#16a34a', fontSize: 16, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: 'bold', flex: 1, marginRight: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 13, color: '#555' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  navButton: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  navButtonText: { color: '#15803d', fontSize: 15, fontWeight: '600' },
  photoRow: { gap: 8, paddingVertical: 8 },
  photo: { width: 120, height: 90, borderRadius: 8, backgroundColor: '#eee' },
  addPhoto: {
    width: 120,
    height: 90,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#16a34a',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  addPhotoText: { color: '#15803d', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  empty: { color: '#666', textAlign: 'center', marginTop: 24, lineHeight: 20 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  productName: { fontSize: 15, fontWeight: '500' },
  inactive: { color: '#999', textDecorationLine: 'line-through' },
  productMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  chevron: { fontSize: 22, color: '#bbb' },
  addButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
