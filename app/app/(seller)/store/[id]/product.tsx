import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/errors';
import { createProduct, listProducts, updateProduct } from '@/lib/products';
import { colors, fonts, radius, scrollWrap } from '@/lib/theme';

export default function ProductForm() {
  const insets = useSafeAreaInsets();
  const { id: storeId, productId } = useLocalSearchParams<{
    id: string;
    productId?: string;
  }>();
  const isEdit = !!productId;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0); // "added this session" (PA-11)
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    // Edit mode: load the existing product's values into the form.
    if (!isEdit || !storeId) return;
    listProducts(storeId).then((all) => {
      const p = all.find((x) => x.id === productId);
      if (!p) return;
      setName(p.name);
      setPrice(String(p.price));
      setStock(String(p.stock));
      setIsActive(p.is_active);
    });
  }, [isEdit, productId, storeId]);

  const parseForm = () => {
    const priceNum = parseInt(price.replace(/\D/g, ''), 10);
    const stockNum = parseInt(stock.replace(/\D/g, ''), 10);
    if (!name.trim() || isNaN(priceNum) || isNaN(stockNum)) {
      Alert.alert('NgomongAja', 'Isi nama, harga, dan stok dengan benar ya.');
      return null;
    }
    return { name: name.trim(), price: priceNum, stock: stockNum };
  };

  const save = async (addAnother: boolean) => {
    if (!storeId) return;
    const values = parseForm();
    if (!values) return;

    setSubmitting(true);
    try {
      if (isEdit && productId) {
        await updateProduct(productId, { ...values, is_active: isActive });
        router.back();
        return;
      }
      await createProduct(storeId, values);
      if (addAnother) {
        // Rapid entry (PA-11): clear the form, keep the screen and keyboard,
        // put the cursor back in "name" — ready for the next item.
        setSessionCount((c) => c + 1);
        setName('');
        setPrice('');
        setStock('');
        nameRef.current?.focus();
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert('Gagal menyimpan', friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.back}>‹ Toko</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Ubah Barang' : 'Tambah Barang'}</Text>
        {!isEdit && sessionCount > 0 && (
          <View style={styles.achievement}>
            <Text style={styles.achievementText}>
              🔥 {sessionCount} barang ditambahkan sesi ini!
            </Text>
          </View>
        )}

        <Text style={styles.label}>Nama barang</Text>
        <TextInput
          ref={nameRef}
          style={styles.input}
          placeholder="Contoh: Minyak Goreng Bimoli 1L"
          placeholderTextColor={colors.secondary}
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <Text style={styles.label}>Harga (Rupiah)</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 18000"
          placeholderTextColor={colors.secondary}
          keyboardType="number-pad"
          value={price}
          onChangeText={setPrice}
        />
        <Text style={styles.label}>Stok</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 12"
          placeholderTextColor={colors.secondary}
          keyboardType="number-pad"
          value={stock}
          onChangeText={setStock}
        />

        {isEdit && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Tampilkan ke pembeli</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              accessibilityLabel="Tampilkan barang ke pembeli"
            />
          </View>
        )}

        {!isEdit && (
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => save(true)}
            disabled={submitting}
            accessibilityRole="button">
            {submitting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Simpan & Tambah Lagi</Text>
            )}
          </Pressable>
        )}

        <Pressable
          style={styles.button}
          onPress={() => save(false)}
          disabled={submitting}
          accessibilityRole="button">
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {isEdit ? 'Simpan Perubahan' : 'Simpan & Selesai'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.cancelWrap}>
          <Text style={styles.cancel}>Batal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { ...scrollWrap, gap: 12 },
  backWrap: { alignSelf: 'flex-start', paddingVertical: 12 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontFamily: fonts.heading, color: colors.text },
  achievement: {
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberSoftBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  achievementText: { color: '#854d0e', fontSize: 14, fontWeight: '700' },
  label: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.body, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 15, color: colors.body },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  secondaryButtonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '600' },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  cancelWrap: { alignSelf: 'center', paddingVertical: 12, marginTop: 4 },
  cancel: { textAlign: 'center', color: colors.body, fontSize: 14 },
});
