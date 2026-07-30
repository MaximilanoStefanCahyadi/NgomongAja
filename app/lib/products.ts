import { supabase } from './supabase';

export type Product = {
  id: string;
  store_id: string;
  name: string;
  price: number; // integer Rupiah — never floats for money
  stock: number;
  is_active: boolean;
  discount_percent: number; // 0–90
};

export type NewProduct = {
  name: string;
  price: number;
  stock: number;
  discount_percent?: number;
};

const COLUMNS = 'id, store_id, name, price, stock, is_active, discount_percent';

/**
 * The price after discount, for DISPLAY ONLY.
 *
 * This mirrors `public.discounted_price()` in the database, which is what
 * actually charges the buyer — the client never sends a price or a total to
 * the server, only product ids and quantities. Keep the two in step: round
 * after the divide, or the two disagree by a rupiah and the receipt looks
 * wrong to a warung owner counting cash.
 */
export function finalPrice(p: Pick<Product, 'price' | 'discount_percent'>): number {
  if (!p.discount_percent) return p.price;
  return Math.round((p.price * (100 - p.discount_percent)) / 100);
}

export const hasDiscount = (p: Pick<Product, 'discount_percent'>) => p.discount_percent > 0;

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(COLUMNS)
    .eq('store_id', storeId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Product[];
}

// Buyer-facing catalog: only products the seller wants shown.
export async function listActiveProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(COLUMNS)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Product[];
}

export type DiscountedProduct = Product & { stores: { name: string } | null };

/**
 * The "Lagi diskon" rail. Scoped to the warungs already near the buyer —
 * a discount three towns away is not an offer, it is noise. Out-of-stock
 * items are excluded so the rail never advertises something unbuyable.
 */
export async function listDiscountedProducts(
  storeIds: string[],
  limit = 12
): Promise<DiscountedProduct[]> {
  if (storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('products')
    .select(`${COLUMNS}, stores(name)`)
    .in('store_id', storeIds)
    .eq('is_active', true)
    .gt('discount_percent', 0)
    .gt('stock', 0)
    .order('discount_percent', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as DiscountedProduct[];
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
  changes: Partial<Pick<Product, 'name' | 'price' | 'stock' | 'is_active' | 'discount_percent'>>
): Promise<void> {
  const { error } = await supabase.from('products').update(changes).eq('id', id);
  if (error) throw error;
}
