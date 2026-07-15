import { supabase } from './supabase';

export type StorePhoto = { id: string; store_id: string; image_url: string };

export async function listStorePhotos(storeId: string): Promise<StorePhoto[]> {
  const { data, error } = await supabase
    .from('store_photos')
    .select('id, store_id, image_url')
    .eq('store_id', storeId);
  if (error) throw error;
  return data as StorePhoto[];
}

// Upload to the PUBLIC store-photos bucket (path starts with the seller's uid
// per the storage policy), store the public URL for direct display.
export async function addStorePhoto(
  ownerId: string,
  storeId: string,
  imageUri: string
): Promise<void> {
  const path = `${ownerId}/${storeId}-${Date.now()}.jpg`;

  const form = new FormData();
  form.append('file', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { error: uploadError } = await supabase.storage
    .from('store-photos')
    .upload(path, form, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from('store-photos').getPublicUrl(path);
  const { error } = await supabase
    .from('store_photos')
    .insert({ store_id: storeId, image_url: pub.publicUrl });
  if (error) throw error;
}
