import { Feather } from '@expo/vector-icons';
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
import { colors, fonts, radius, screenWrap } from '@/lib/theme';

export default function StoreInventory() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
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
    } catch (e) {
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

  const visibleProducts =
    query.trim().length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : products;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={styles.backWrap}
        accessibilityRole="button"
        accessibilityLabel="Kembali">
        <Feather name="chevron-left" size={18} color={colors.primaryDark} />
        <Text style={styles.back}>Toko Saya</Text>
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
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Toko buka"
          />
        </View>
      </View>

      <View style={styles.navRow}>
        <Link
          href={{ pathname: '/(seller)/store/[id]/orders', params: { id: store.id } }}
          asChild>
          <Pressable style={styles.navButton} accessibilityRole="button">
            <Feather name="inbox" size={17} color={colors.primaryDeep} />
            <Text style={styles.navButtonText}>Pesanan</Text>
          </Pressable>
        </Link>
        <Link
          href={{ pathname: '/(seller)/store/[id]/recap', params: { id: store.id } }}
          asChild>
          <Pressable style={styles.navButton} accessibilityRole="button">
            <Feather name="bar-chart-2" size={17} color={colors.primaryDeep} />
            <Text style={styles.navButtonText}>Rekap</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.feeRow}>
        <Text style={styles.feeLabel}>Ongkir antar:</Text>
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

      <View style={styles.photoSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: p.image_url }} style={styles.photo} />
          ))}
          <Pressable
            style={styles.addPhoto}
            onPress={pickPhoto}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Tambah foto toko">
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Feather name="camera" size={18} color={colors.primaryDark} />
                <Text style={styles.addPhotoText}>Tambah{'\n'}Foto</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Daftar Barang</Text>
        <Text style={styles.countTag}>{products.length} barang</Text>
      </View>

      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari barang…"
          placeholderTextColor={colors.secondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={visibleProducts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 9, paddingVertical: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query
              ? 'Tidak ada barang dengan nama itu.'
              : 'Belum ada barang. Tekan "Tambah Barang" — mode cepatnya dibuat untuk memasukkan banyak barang berturut-turut.'}
          </Text>
        }
        renderItem={({ item }) => {
          const out = item.stock === 0;
          return (
            <View style={[styles.productRow, out && styles.productRowOut]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.productName, !item.is_active && styles.inactive]}>
                  {item.name}
                </Text>
                {out ? (
                  <Text style={styles.productMetaOut}>
                    {formatRupiah(item.price)} · Habis — isi stok?
                  </Text>
                ) : (
                  <Text style={styles.productMeta}>
                    <Text style={styles.productPrice}>{formatRupiah(item.price)}</Text> · stok{' '}
                    {item.stock}
                    {!item.is_active && ' · disembunyikan'}
                  </Text>
                )}
              </View>
              {out ? (
                <Pressable
                  style={styles.stockBtn}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/(seller)/store/[id]/product',
                      params: { id: store.id, productId: item.id },
                    })
                  }>
                  <Text style={styles.stockBtnText}>+ Stok</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.editBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Ubah ${item.name}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(seller)/store/[id]/product',
                      params: { id: store.id, productId: item.id },
                    })
                  }>
                  <Feather name="edit-2" size={16} color={colors.body} />
                </Pressable>
              )}
            </View>
          );
        }}
      />

      <Link
        href={{ pathname: '/(seller)/store/[id]/product', params: { id: store.id } }}
        asChild>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: colors.primaryDark }]}
          accessibilityRole="button">
          <Feather name="plus" size={20} color={colors.onPrimary} />
          <Text style={styles.addButtonText}>Tambah Barang</Text>
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
  backWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  back: { color: colors.primaryDark, fontSize: 15, fontFamily: fonts.bodySemi },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
    flex: 1,
    marginRight: 12,
    color: colors.text,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.body },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navButton: {
    flex: 1,
    backgroundColor: colors.primaryChipBg,
    borderRadius: radius.pill,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: { color: colors.primaryDeep, fontSize: 15, fontFamily: fonts.heading },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  feeLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.body },
  feeValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  feeEdit: {
    color: colors.primaryDark,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    padding: 4,
  },
  feeInput: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    fontSize: 14,
    fontFamily: fonts.body,
    minWidth: 90,
    backgroundColor: colors.card,
    color: colors.text,
  },
  photoSection: { marginTop: 12 },
  photoRow: { gap: 8 },
  photo: { width: 108, height: 80, borderRadius: radius.md, backgroundColor: colors.neutralBg },
  addPhoto: {
    width: 108,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
  },
  addPhotoText: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontFamily: fonts.bodySemi,
    textAlign: 'center',
    lineHeight: 14,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  countTag: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.primaryDeep,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
    paddingVertical: 9,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.body,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 21,
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
  productRowOut: {
    backgroundColor: colors.amberBg,
    borderWidth: 1.5,
    borderColor: colors.amberBorder,
  },
  productName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  inactive: { color: colors.secondary, textDecorationLine: 'line-through' },
  productMeta: { fontFamily: fonts.body, fontSize: 13.5, color: colors.secondary, marginTop: 2 },
  productPrice: { fontFamily: fonts.bodyBold, color: colors.primaryDark },
  productMetaOut: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.sunnyText,
    marginTop: 2,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  stockBtnText: { color: '#fff', fontSize: 13.5, fontFamily: fonts.heading },
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
});
