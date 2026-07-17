// The ONE canonical place for order-status / payment presentation.
// Every screen imports these instead of keeping a local copy, so a
// status is always worded and colored the same everywhere.
// Per the Hijau Rupiah design: plain-text pill tags — green for good,
// orange for needs-attention, warm neutral for calm facts.

import type { OrderStatus, PaymentMethod } from '@/lib/orders';

export type PaymentStatus = 'pending' | 'paid' | 'voided';

export const STATUS_CHIP: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Menunggu', bg: '#fff0d8', fg: '#784200' },
  accepted: { label: 'Diproses', bg: '#c0edd0', fg: '#05431f' },
  ready: { label: 'Siap', bg: '#c0edd0', fg: '#05431f' },
  completed: { label: 'Selesai', bg: '#e0f7e7', fg: '#075c2b' },
  rejected: { label: 'Ditolak', bg: '#fdecea', fg: '#b42318' },
  cancelled: { label: 'Dibatalkan', bg: '#fdecea', fg: '#b42318' },
};

// Payment badge. "voided" means the order died (rejected/cancelled),
// so the money never needs to move — NOT "payment cancelled".
export const PAYMENT_BADGE: Record<PaymentStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Belum dibayar', bg: '#fff0d8', fg: '#784200' },
  paid: { label: 'Lunas', bg: '#c0edd0', fg: '#05431f' },
  voided: { label: 'Tidak perlu dibayar', bg: '#eee7db', fg: '#645c50' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'COD — bayar di tempat',
  gopay: 'GoPay',
  transfer: 'Transfer Bank',
};
