import { supabase } from './supabase';

export type Store = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  gmaps_url: string | null;
  is_active: boolean;
  delivery_fee: number;
  created_at: string;
  /** Speciality slugs from lib/specialty.ts. Constrained by the database. */
  specialty: string[];
};

/** Per-warung aggregates from the `store_stats` view. */
export type StoreStats = {
  store_id: string;
  product_count: number;
  discount_count: number;
  /** null until someone reviews the warung. */
  avg_rating: number | null;
  review_count: number;
};

/**
 * Aggregates for the home's recommendation rails, keyed by store id.
 *
 * One round trip for all four rails. Reads the `store_stats` view, which is
 * deliberately not security_invoker so ratings average across every buyer's
 * orders rather than only the caller's — see the migration for why.
 */
export async function listStoreStats(storeIds: string[]): Promise<Map<string, StoreStats>> {
  if (storeIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('store_stats')
    .select('store_id, product_count, discount_count, avg_rating, review_count')
    .in('store_id', storeIds);
  if (error) throw error;
  return new Map((data as StoreStats[]).map((s) => [s.store_id, s]));
}

export type NewStore = {
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  gmaps_url?: string;
  specialty?: string[];
};

export async function listMyStores(ownerId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Store[];
}

export async function getStore(id: string): Promise<Store> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Store;
}

/**
 * Warung name search for the Cari tab. `ilike` is case-insensitive; the % are
 * escaped so a buyer typing "%" searches for a literal percent rather than
 * matching every warung in the country.
 */
export async function searchStores(query: string): Promise<Store[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${escaped}%`)
    .order('name', { ascending: true })
    .limit(30);
  if (error) throw error;
  return data as Store[];
}

export async function createStore(ownerId: string, store: NewStore): Promise<Store> {
  const { data, error } = await supabase
    .from('stores')
    .insert({ owner_id: ownerId, ...store })
    .select()
    .single();
  if (error) throw error;
  return data as Store;
}

export async function setStoreActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

/**
 * What the warung is known for. The database validates the slugs against
 * `stores_specialty_check`, so a bad value fails loudly rather than creating a
 * category the buyer's chips cannot render.
 */
export async function setStoreSpecialty(id: string, specialty: string[]): Promise<void> {
  const { error } = await supabase.from('stores').update({ specialty }).eq('id', id);
  if (error) throw error;
}

// PA-8: each store sets its own delivery fee.
export async function setStoreDeliveryFee(id: string, fee: number): Promise<void> {
  const { error } = await supabase.from('stores').update({ delivery_fee: fee }).eq('id', id);
  if (error) throw error;
}

export type NearbyStore = Store & { distance_km: number };

// Straight-line distance between two GPS points, in km (haversine formula).
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function listNearbyStores(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<NearbyStore[]> {
  // Cheap pre-filter: a square "bounding box" around the buyer. One degree of
  // latitude ≈ 111.32 km; a longitude degree shrinks by cos(latitude).
  // The (lat, lng) index makes this range query fast.
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta)
    .lte('lng', lng + lngDelta);
  if (error) throw error;

  // The box has corners outside the circle — compute the real distance for
  // the few candidates, drop anything beyond the radius, nearest first.
  return (data as Store[])
    .map((s) => ({ ...s, distance_km: haversineKm(lat, lng, s.lat!, s.lng!) }))
    .filter((s) => s.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}
