import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createProduct, listProducts, updateProduct } from '@/lib/products';

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
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isEdit ? 'Ubah Barang' : 'Tambah Barang'}</Text>
      {!isEdit && sessionCount > 0 && (
        <Text style={styles.counter}>✓ {sessionCount} barang ditambahkan sesi ini</Text>
      )}

      <TextInput
        ref={nameRef}
        style={styles.input}
        placeholder="Nama barang (contoh: Minyak Goreng Bimoli 1L)"
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Harga (Rupiah, contoh: 18000)"
        keyboardType="number-pad"
        value={price}
        onChangeText={setPrice}
      />
      <TextInput
        style={styles.input}
        placeholder="Stok (contoh: 12)"
        keyboardType="number-pad"
        value={stock}
        onChangeText={setStock}
      />

      {isEdit && (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Tampilkan ke pembeli</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      )}

      {!isEdit && (
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => save(true)}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.secondaryButtonText}>Simpan & Tambah Lagi</Text>
          )}
        </Pressable>
      )}

      <Pressable style={styles.button} onPress={() => save(false)} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isEdit ? 'Simpan Perubahan' : 'Simpan & Selesai'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Batal</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 28, fontWeight: 'bold' },
  counter: { color: '#15803d', fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 15, color: '#444' },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  secondaryButtonText: { color: '#15803d', fontSize: 16, fontWeight: '600' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { textAlign: 'center', color: '#666', marginTop: 8, fontSize: 14 },
});
