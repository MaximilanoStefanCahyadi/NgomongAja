import { supabase } from './supabase';

export type PaymentMethod = 'cash' | 'gopay' | 'transfer';
export type Fulfillment = 'pickup' | 'delivery';

export type OrderLine = { productId: string; quantity: number };

export const DELIVERY_FEE = 5000; // display only — the DB computes the real one

// Atomic checkout: one RPC call = order + items + payment in one transaction.
// The database recomputes the total from live catalog prices; we only send
// product ids and quantities.
export async function placeOrder(params: {
  storeId: string;
  fulfillment: Fulfillment;
  deliveryAddress: string | null;
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('place_order', {
    p_store_id: params.storeId,
    p_fulfillment: params.fulfillment,
    p_delivery_address: params.deliveryAddress,
    p_payment_method: params.paymentMethod,
    p_items: params.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
  });
  if (error) throw error;
  return data as string; // the new order id
}

// Buyer's simulated "pay now" for gopay/transfer (PA-12: demo, no real money).
// The `.eq('status','pending')` guard prevents a race where the order was
// cancelled/rejected (payment already 'voided') between render and tap —
// without it, that voided payment would flip back to 'paid'.
export async function markPaidByBuyer(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  if (error) throw error;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'ready'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type OrderRow = {
  id: string;
  buyer_id: string;
  store_id: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  delivery_address: string | null;
  delivery_fee: number;
  total: number;
  created_at: string;
  stores: { name: string; owner_id: string } | null;
  buyer: { full_name: string; phone: string | null } | null;
  payments: { method: PaymentMethod; status: 'pending' | 'paid' | 'voided' }[];
  // Lightweight item summary for list cards ("Minyak Goreng × 2 · Telur × 0,5 kg").
  order_items: { quantity: number; products: { name: string } | null }[];
};

export type OrderItemRow = {
  quantity: number;
  unit_price: number;
  // Full product row so "Pesan Lagi" (PA-5) can rebuild a cart from history.
  products: {
    id: string;
    store_id: string;
    name: string;
    price: number;
    stock: number;
    is_active: boolean;
  } | null;
};

const ORDER_SELECT =
  'id, buyer_id, store_id, status, fulfillment, delivery_address, delivery_fee, total, created_at, stores(name, owner_id), buyer:profiles(full_name, phone), payments(method, status), order_items(quantity, products(name))';

// Check-on-read expiry (PRD AS-12): call before loading any order list.
export async function expireStaleOrders(): Promise<void> {
  const { error } = await supabase.rpc('expire_stale_orders');
  if (error) console.warn('expireStaleOrders:', error.message);
}

export async function listMyOrders(buyerId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as OrderRow[];
}

export async function listStoreOrders(storeId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as OrderRow[];
}

export async function getOrder(orderId: string): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data as unknown as OrderRow;
}

export async function listOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('quantity, unit_price, products(id, store_id, name, price, stock, is_active)')
    .eq('order_id', orderId);
  if (error) throw error;
  return data as unknown as OrderItemRow[];
}

// Status transitions. RLS + the DB triggers enforce legality and side effects
// (stock decrement/restore, payment voiding) — the app just asks.
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}

// Global pending count across all of a seller's stores (S-1 badge).
export async function countPendingForOwner(ownerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id, stores!inner(owner_id)', { count: 'exact', head: true })
    .eq('stores.owner_id', ownerId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

// Live updates for one order (buyer's PA-2 status screen).
export function subscribeToOrder(orderId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'payments', filter: `order_id=eq.${orderId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Upload the voice recording to the private bucket, then link it to the order.
// Best-effort: an order without its audio is still a valid order, so callers
// may catch and continue.
export async function attachRecording(
  buyerId: string,
  orderId: string,
  audioUri: string,
  parsedJson: unknown
): Promise<void> {
  const path = `${buyerId}/${Date.now()}.m4a`; // first folder = uid (RLS rule)

  const form = new FormData();
  form.append('file', {
    uri: audioUri,
    name: 'order.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);

  const { error: uploadError } = await supabase.storage
    .from('voice-recordings')
    .upload(path, form, { contentType: 'audio/m4a' });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('voice_recordings').insert({
    buyer_id: buyerId,
    order_id: orderId,
    audio_url: path, // private bucket: store the path, sign URLs when playing
    parsed_json: parsedJson,
  });
  if (error) throw error;
}
