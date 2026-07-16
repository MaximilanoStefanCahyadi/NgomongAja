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
  TextInput,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import { listProducts, type Product } from '@/lib/products';
import { addStorePhoto, listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, setStoreActive, setStoreDeliveryFee, type Store } from '@/lib/stores';
import { colors, radius, screenWrap } from '@/lib/theme';

export default function StoreInventory() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  // PA-8: per-store delivery fee editor (null = not editing).
  const [feeDraft, setFeeDraft] = useState<string | null>(null);

  const saveFee = async () => {
    if (!store || feeDraft === null) return;
    const fee = parseInt(feeDraft.replace(/\D/g, ''), 10);
    if (isNaN(fee) || fee < 0) {
      Alert.alert('NgomongAja', 'Isi ongkir dengan angka ya (0 boleh, artinya gratis).');
      return;
    }
    try {
      await setStoreDeliveryFee(store.id, fee);
      setStore({ ...store, delivery_fee: fee });
      setFeeDraft(null);
    } catch (e) {
      Alert.alert('Gagal menyimpan ongkir', friendlyError(e));
    }
  };

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
    } catch (e) {
      Alert.alert('Gagal mengunggah foto', friendlyError(e));
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
      Alert.alert('Gagal', friendlyError(e));
    }
  };

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
        <Text style={styles.back}>‹ Toko Saya</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {store.name}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{store.is_active ? 'Buka' : 'Tutup'}</Text>
          <Switch
            value={store.is_active}
            onValueChange={toggleOpen}
            accessibilityLabel="Toko buka"
          />
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

      <View style={styles.feeRow}>
        <Text style={styles.feeLabel}>🛵 Ongkir antar:</Text>
        {feeDraft === null ? (
          <>
            <Text style={styles.feeValue}>{formatRupiah(store.delivery_fee)}</Text>
            <Pressable
              onPress={() => setFeeDraft(String(store.delivery_fee))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Ubah ongkir">
              <Text style={styles.feeEdit}>Ubah</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.feeInput}
              keyboardType="number-pad"
              value={feeDraft}
              onChangeText={setFeeDraft}
              autoFocus
            />
            <Pressable onPress={saveFee} hitSlop={10} accessibilityRole="button">
              <Text style={styles.feeEdit}>Simpan</Text>
            </Pressable>
          </>
        )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: { ...screenWrap },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: 'bold', flex: 1, marginRight: 12, color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 13, color: colors.body },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, color: colors.text },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  navButton: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
  },
  navButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  feeLabel: { fontSize: 14, color: colors.body },
  feeValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  feeEdit: { color: colors.primary, fontSize: 14, fontWeight: '600', padding: 4 },
  feeInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    minWidth: 90,
    backgroundColor: colors.card,
    color: colors.text,
  },
  photoRow: { gap: 8, paddingVertical: 8 },
  photo: { width: 120, height: 90, borderRadius: radius.sm, backgroundColor: colors.neutralBg },
  addPhoto: {
    width: 120,
    height: 90,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  addPhotoText: { color: colors.primaryDark, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  empty: { color: colors.body, textAlign: 'center', marginTop: 24, lineHeight: 20 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: { fontSize: 15, fontWeight: '500', color: colors.text },
  inactive: { color: colors.secondary, textDecorationLine: 'line-through' },
  productMeta: { fontSize: 13, color: colors.body, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.secondary },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  addButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
