import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  View,
} from 'react-native';

import {
  Button,
  Card,
  Field,
  IconButton,
  ListState,
  Screen,
  ScreenHeader,
  SectionLabel,
  Tag,
  Text,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { friendlyError } from '@/lib/errors';
import { formatRupiah } from '@/lib/format';
import { listProducts, type Product } from '@/lib/products';
import { addStorePhoto, listStorePhotos, type StorePhoto } from '@/lib/store-photos';
import { getStore, setStoreActive, setStoreDeliveryFee, type Store } from '@/lib/stores';
import { colors, radius, spacing } from '@/lib/theme';

export default function StoreInventory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [photos, setPhotos] = useState<StorePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  // PA-8: per-store delivery fee editor (null = not editing).
  const [feeDraft, setFeeDraft] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | undefined>();

  const saveFee = async () => {
    if (!store || feeDraft === null) return;
    const fee = parseInt(feeDraft.replace(/\D/g, ''), 10);
    if (isNaN(fee) || fee < 0) {
      // Inline, next to the field it is about — not a modal that hides it.
      setFeeError('Isi ongkir dengan angka ya (0 boleh, artinya gratis).');
      return;
    }
    try {
      await setStoreDeliveryFee(store.id, fee);
      setStore({ ...store, delivery_fee: fee });
      setFeeDraft(null);
      setFeeError(undefined);
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
      <Screen centered>
        <ListState state="loading" message="Memuat toko…" />
      </Screen>
    );
  }

  const visibleProducts =
    query.trim().length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
      : products;

  const openProduct = (productId?: string) =>
    router.push({
      pathname: '/(seller)/store/[id]/product',
      params: productId ? { id: store.id, productId } : { id: store.id },
    });

  return (
    <Screen
      keyboard
      footer={
        // The primary CTA lives in the footer, so it stays reachable instead
        // of floating mid-screen when the product list is short.
        <Button label="Tambah Barang" icon="plus" onPress={() => openProduct()} />
      }>
      <ScreenHeader
        title={store.name}
        backLabel="Toko Saya"
        right={
          <View style={styles.toggleRow}>
            <Text variant="label" color="body">
              {store.is_active ? 'Buka' : 'Tutup'}
            </Text>
            <Switch
              value={store.is_active}
              onValueChange={toggleOpen}
              trackColor={{ true: colors.primary, false: colors.neutralBg }}
              accessibilityLabel="Toko buka"
            />
          </View>
        }
      />

      {/* Quiet, so the one green control on this screen is "Tambah Barang". */}
      <View style={styles.navRow}>
        <Button
          label="Pesanan"
          icon="inbox"
          variant="quiet"
          size="md"
          style={styles.navButton}
          onPress={() =>
            router.push({
              pathname: '/(seller)/store/[id]/orders',
              params: { id: store.id },
            })
          }
        />
        <Button
          label="Rekap"
          icon="bar-chart-2"
          variant="quiet"
          size="md"
          style={styles.navButton}
          onPress={() =>
            router.push({
              pathname: '/(seller)/store/[id]/recap',
              params: { id: store.id },
            })
          }
        />
      </View>

      {feeDraft === null ? (
        <View style={styles.feeRow}>
          <Text variant="body" color="body">
            Ongkir antar
          </Text>
          <Text variant="money">{formatRupiah(store.delivery_fee)}</Text>
          <Button
            label="Ubah"
            variant="quiet"
            size="md"
            fullWidth={false}
            accessibilityLabel="Ubah ongkir"
            onPress={() => setFeeDraft(String(store.delivery_fee))}
          />
        </View>
      ) : (
        <Field
          label="Ongkir antar"
          keyboardType="number-pad"
          value={feeDraft}
          onChangeText={(t) => {
            setFeeDraft(t);
            if (feeError) setFeeError(undefined);
          }}
          error={feeError}
          autoFocus
          containerStyle={styles.feeField}
          rightAction={{ label: 'Simpan', onPress: saveFee }}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.photoScroll}
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
            <ActivityIndicator color={colors.primaryInk} />
          ) : (
            <>
              <Feather name="camera" size={18} color={colors.body} />
              <Text variant="tag" color="body" align="center">
                Tambah{'\n'}Foto
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      <SectionLabel right={<Tag label={`${products.length} barang`} />}>Daftar Barang</SectionLabel>

      <Field
        leftIcon="search"
        placeholder="Cari barang…"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Cari barang"
      />

      <FlatList
        data={visibleProducts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ListState
            state="empty"
            icon="package"
            message={
              query
                ? 'Tidak ada barang dengan nama itu.'
                : 'Belum ada barang. Tekan "Tambah Barang" — mode cepatnya dibuat untuk memasukkan banyak barang berturut-turut.'
            }
          />
        }
        renderItem={({ item }) => {
          const out = item.stock === 0;
          return (
            // "Habis" is ONE signal: a warn-toned card (tint + left rule).
            // No extra border, no bold amber text, no solid amber button.
            <Card tone={out ? 'warn' : 'default'} padding="sm" row>
              <View style={styles.productMain}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.productMeta}>
                  <Text variant="money">{formatRupiah(item.price)}</Text>
                  <Text variant="meta" color="secondary" numberOfLines={2} style={styles.flex}>
                    {out
                      ? '· Habis — isi stok?'
                      : `· stok ${item.stock}${!item.is_active ? ' · disembunyikan' : ''}`}
                  </Text>
                </View>
              </View>
              {out ? (
                <Button
                  label="+ Stok"
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  accessibilityLabel={`Isi stok ${item.name}`}
                  onPress={() => openProduct(item.id)}
                />
              ) : (
                <IconButton
                  icon="edit-2"
                  accessibilityLabel={`Ubah ${item.name}`}
                  onPress={() => openProduct(item.id)}
                />
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

// Screen-specific layout only — every control above comes from the kit.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  navButton: { flex: 1 },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  feeField: { marginTop: spacing.md },
  photoScroll: { flexGrow: 0, marginTop: spacing.md },
  photoRow: { gap: spacing.sm },
  photo: {
    width: 108,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
  },
  addPhoto: {
    width: 108,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  productMain: { flex: 1, minWidth: 0, gap: 2 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
