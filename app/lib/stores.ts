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
  created_at: string;
};

export type NewStore = {
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  gmaps_url?: string;
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
