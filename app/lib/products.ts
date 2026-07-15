import { supabase } from './supabase';

export type Product = {
  id: string;
  store_id: string;
  name: string;
  price: number; // integer Rupiah — never floats for money
  stock: number;
  is_active: boolean;
};

export type NewProduct = {
  name: string;
  price: number;
  stock: number;
};

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, store_id, name, price, stock, is_active')
    .eq('store_id', storeId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Product[];
}

// Buyer-facing catalog: only products the seller wants shown.
export async function listActiveProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, store_id, name, price, stock, is_active')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(storeId: string, p: NewProduct): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ store_id: storeId, ...p, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  id: string,
  changes: Partial<Pick<Product, 'name' | 'price' | 'stock' | 'is_active'>>
): Promise<void> {
  const { error } = await supabase.from('products').update(changes).eq('id', id);
  if (error) throw error;
}
