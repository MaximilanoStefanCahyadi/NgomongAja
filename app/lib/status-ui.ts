// The ONE canonical place for order-status / payment presentation.
// Every screen imports these instead of keeping a local copy, so a
// status is always worded, colored, and iconed the same everywhere.
// Each label leads with an emoji so it reads at a glance and never relies
// on color alone (accessibility + all-ages comprehension).

import type { OrderStatus, PaymentMethod } from '@/lib/orders';

export type PaymentStatus = 'pending' | 'paid' | 'voided';

// Chip per order status: pending amber, accepted blue, ready teal,
// completed green, rejected/cancelled red.
export const STATUS_CHIP: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: '🕐 Menunggu', bg: '#fff3d0', fg: '#8a4b00' },
  accepted: { label: '👨‍🍳 Diproses', bg: '#dbeafe', fg: '#1e40af' },
  ready: { label: '📦 Siap', bg: '#ccfbf1', fg: '#0f766e' },
  completed: { label: '✅ Selesai', bg: '#d6f5e0', fg: '#063d20' },
  rejected: { label: '❌ Ditolak', bg: '#fdecea', fg: '#b42318' },
  cancelled: { label: '❌ Dibatalkan', bg: '#fdecea', fg: '#b42318' },
};

// Payment badge. "voided" means the order died (rejected/cancelled),
// so the money never needs to move — NOT "payment cancelled".
export const PAYMENT_BADGE: Record<PaymentStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: '💵 Belum dibayar', bg: '#fff3d0', fg: '#8a4b00' },
  paid: { label: '✅ Lunas', bg: '#d6f5e0', fg: '#063d20' },
  voided: { label: '— Tidak perlu dibayar', bg: '#f4f1ea', fg: '#5c655f' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Bayar tunai di tempat (COD)',
  gopay: 'GoPay',
  transfer: 'Transfer Bank',
};
