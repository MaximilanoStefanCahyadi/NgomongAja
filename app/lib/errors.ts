// Maps raw (usually English) errors from Supabase/network into short,
// friendly Indonesian sentences. Use this in every Alert instead of e.message.

export function friendlyError(e: unknown): string {
  const raw =
    e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
  console.warn('friendlyError:', raw); // keep the raw error for debugging

  if (raw.includes('Invalid login credentials')) {
    return 'Email atau kata sandi salah. Coba lagi ya.';
  }
  if (raw.includes('User already registered')) {
    return 'Email ini sudah terdaftar. Coba masuk saja.';
  }
  if (raw.includes('Network request failed')) {
    return 'Tidak ada koneksi internet.';
  }
  // Server-side messages already written for the buyer (e.g. the place_order
  // stock check "Stok … tidak cukup") pass through as-is.
  if (raw.includes('Stok ') && raw.includes('tidak cukup')) {
    return raw.replace(/^.*?(Stok )/, '$1');
  }
  return 'Ada gangguan. Coba lagi sebentar lagi.';
}
