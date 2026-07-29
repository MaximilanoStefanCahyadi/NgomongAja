// Maps raw (usually English) errors from Supabase/network into short,
// friendly Indonesian sentences. Use this in every Alert instead of e.message.

export function friendlyError(e: unknown): string {
  const raw =
    e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
  console.warn('friendlyError:', raw); // keep the raw error for debugging

  // Voice rule: never say the user got it wrong, never show "error". Offer a
  // way out, not a diagnosis.
  if (raw.includes('Invalid login credentials')) {
    return 'Email atau kata sandinya belum cocok. Coba cek lagi ya.';
  }
  if (raw.includes('User already registered')) {
    return 'Email ini sudah punya akun. Masuk aja langsung.';
  }
  if (raw.includes('Network request failed')) {
    return 'Internetnya lagi putus. Coba lagi sebentar ya.';
  }
  // Server-side messages already written for the buyer (e.g. the place_order
  // stock check "Stok … tidak cukup") pass through as-is.
  if (raw.includes('Stok ') && raw.includes('tidak cukup')) {
    return raw.replace(/^.*?(Stok )/, '$1');
  }
  // System failure: admit it briefly, never explain the plumbing.
  return 'Lagi lemot nih. Coba sebentar lagi ya.';
}
