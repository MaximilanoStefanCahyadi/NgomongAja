import { supabase } from './supabase';

export type Verification = {
  id: string;
  profile_id: string;
  ktp_number: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function getMyVerification(profileId: string): Promise<Verification | null> {
  const { data, error } = await supabase
    .from('buyer_verifications')
    .select('id, profile_id, ktp_number, status, rejection_reason, created_at, reviewed_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Verification | null;
}

// Upload the KTP photo to the private bucket (own folder only), then create
// the verification row. Review happens manually in the Supabase dashboard.
export async function submitVerification(
  profileId: string,
  ktpNumber: string,
  imageUri: string
): Promise<void> {
  const path = `${profileId}/ktp-${Date.now()}.jpg`;

  const form = new FormData();
  form.append('file', { uri: imageUri, name: 'ktp.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { error: uploadError } = await supabase.storage
    .from('ktp-images')
    .upload(path, form, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('buyer_verifications').insert({
    profile_id: profileId,
    ktp_number: ktpNumber,
    ktp_image_url: path,
    status: 'pending',
  });
  if (error) throw error;
}
