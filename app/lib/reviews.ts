import { supabase } from './supabase';

export type StoreReview = {
  store_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

// Public reviews come from the store_reviews VIEW (reviews joined to orders
// with owner privileges — a direct join would be blocked by orders RLS).
export async function listStoreReviews(storeId: string): Promise<StoreReview[]> {
  const { data, error } = await supabase
    .from('store_reviews')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as StoreReview[];
}

export async function getMyReview(orderId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating, comment')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// RLS allows this only for the buyer of a COMPLETED order, once per order.
export async function submitReview(
  orderId: string,
  rating: number,
  comment: string
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .insert({ order_id: orderId, rating, comment: comment.trim() || null });
  if (error) throw error;
}
