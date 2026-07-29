import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { createProduct, listProducts, updateProduct } from '@/lib/products';
import { colors, layout, spacing } from '@/lib/theme';

type Errors = Partial<Record<'name' | 'price' | 'stock', string>>;

export default function ProductForm() {
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
  const [errors, setErrors] = useState<Errors>({});
  const [sessionCount, setSessionCount] = useState(0); // "added this session" (PA-11)
  // Puts the cursor back on the name field after "Simpan & Tambah Lagi",
  // so the seller can keep typing without reaching for the screen.
  const nameRef = useRef<TextInput>(null);

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

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
    // Validation belongs next to the field that is wrong, not in an alert that
    // hides the form behind it.
    const next: Errors = {};
    if (!name.trim()) next.name = 'Isi nama barangnya ya.';
    if (isNaN(priceNum)) next.price = 'Isi harga dengan angka ya.';
    if (isNaN(stockNum)) next.stock = 'Isi stok dengan angka ya.';
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
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
    <Screen
      scroll
      keyboard
      contentContainerStyle={styles.form}
      footer={
        <View style={styles.footer}>
          {!isEdit && (
            <Button
              label="Simpan & Tambah Lagi"
              variant="secondary"
              size="md"
              icon="plus"
              onPress={() => save(true)}
              disabled={submitting}
            />
          )}
          <Button
            label={isEdit ? 'Simpan Perubahan' : 'Simpan & Selesai'}
            onPress={() => save(false)}
            loading={submitting}
          />
        </View>
      }>
      <ScreenHeader title={isEdit ? 'Ubah Barang' : 'Tambah Barang'} backLabel="Toko" />

      {!isEdit && sessionCount > 0 && (
        // Progress, not a warning — one toska tint with a left rule, and the
        // count is plain text rather than bold amber on amber.
        <Card tone="success" padding="sm" row>
          <Feather name="check-circle" size={20} color={colors.successInk} />
          <Text variant="body" color="success" accessibilityLiveRegion="polite">
            {sessionCount} barang ditambahkan sesi ini!
          </Text>
        </Card>
      )}

      <Field
        ref={nameRef}
        label="Nama barang"
        placeholder="Contoh: Minyak Goreng Bimoli 1L"
        value={name}
        onChangeText={(t) => {
          setName(t);
          clear('name');
        }}
        error={errors.name}
        autoFocus
      />
      <Field
        label="Harga (Rupiah)"
        placeholder="Contoh: 18000"
        keyboardType="number-pad"
        value={price}
        onChangeText={(t) => {
          setPrice(t);
          clear('price');
        }}
        error={errors.price}
      />
      <Field
        label="Stok"
        placeholder="Contoh: 12"
        keyboardType="number-pad"
        value={stock}
        onChangeText={(t) => {
          setStock(t);
          clear('stock');
        }}
        error={errors.stock}
      />

      {isEdit && (
        <View style={styles.toggleRow}>
          <Text variant="body" color="body" style={styles.toggleLabel}>
            Tampilkan ke pembeli
          </Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: colors.primary, false: colors.neutralBg }}
            accessibilityLabel="Tampilkan barang ke pembeli"
          />
        </View>
      )}

      <Button label="Batal" variant="quiet" size="md" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xl },
  footer: { gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.minTouch,
  },
  toggleLabel: { flex: 1 },
});
