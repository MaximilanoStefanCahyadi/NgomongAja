import { supabase } from './supabase';

export type Address = {
  id: string;
  profile_id: string;
  label: string | null;
  full_address: string;
  lat: number | null;
  lng: number | null;
};

export async function listAddresses(profileId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('profile_id', profileId);
  if (error) throw error;
  return data as Address[];
}

export async function createAddress(
  profileId: string,
  label: string,
  fullAddress: string
): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ profile_id: profileId, label, full_address: fullAddress })
    .select()
    .single();
  if (error) throw error;
  return data as Address;
}
