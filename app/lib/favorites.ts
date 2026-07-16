import type { Store } from './stores';
import { supabase } from './supabase';

// PA-4: favorite stores. One row per (buyer, store).

export async function listFavoriteStoreIds(profileId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('store_id')
    .eq('profile_id', profileId);
  if (error) throw error;
  return new Set((data as { store_id: string }[]).map((f) => f.store_id));
}

export async function listFavoriteStores(profileId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('stores(*)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as { stores: Store }[]).map((f) => f.stores).filter(Boolean);
}

export async function toggleFavorite(
  profileId: string,
  storeId: string,
  isCurrentlyFavorite: boolean
): Promise<void> {
  if (isCurrentlyFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('profile_id', profileId)
      .eq('store_id', storeId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ profile_id: profileId, store_id: storeId });
    if (error) throw error;
  }
}
