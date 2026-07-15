// "15000" -> "Rp15.000" — Indonesian thousands separator is a dot.
export function formatRupiah(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}
