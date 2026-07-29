// The ONE canonical place for order-status / payment presentation.
// Every screen imports these instead of keeping a local copy, so a status is
// always worded and coloured the same everywhere.
//
// Statuses no longer carry raw hex values — they carry a `tone`, and the tone
// resolves to colours from the theme. That is what stopped this file from
// silently drifting out of sync when the palette changed.
//
// Tone budget (deliberately small):
//   warn    → someone must act
//   success → progressing, nothing to do
//   solid   → the ONE loud status: the buyer's order is ready to collect
//   neutral → a calm, finished fact
//   danger  → the order died

import type { OrderStatus, PaymentMethod } from '@/lib/orders';
import { colors } from '@/lib/theme';

export type PaymentStatus = 'pending' | 'paid' | 'voided';

export type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'solid';

export const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.neutralBg, fg: colors.body }, //  7.75:1
  success: { bg: colors.successBg, fg: colors.successInk }, //  4.65:1 — Toska aktif
  warn: { bg: colors.warnBg, fg: colors.warnInk }, //  4.56:1
  danger: { bg: colors.dangerBg, fg: colors.danger }, //  4.70:1
  solid: { bg: colors.primary, fg: colors.onPrimary }, //  5.97:1 — navy on orange
};

// `bg`/`fg` are derived from `tone` so un-migrated screens keep working.
// Prefer <Tag tone={…}> and drop the direct colour reads.
const chip = (label: string, tone: Tone) => ({
  label,
  tone,
  /** @deprecated use `tone` with <Tag> */ bg: TONE[tone].bg,
  /** @deprecated use `tone` with <Tag> */ fg: TONE[tone].fg,
});

export const STATUS_CHIP: Record<OrderStatus, ReturnType<typeof chip>> = {
  pending: chip('Menunggu', 'warn'), // the seller has to act
  accepted: chip('Diproses', 'success'),
  ready: chip('Siap', 'solid'), // the buyer has to act — the only solid tag
  completed: chip('Selesai', 'neutral'), // done is calm, not celebratory
  rejected: chip('Ditolak', 'danger'),
  cancelled: chip('Dibatalkan', 'danger'),
};

// Payment badge. "voided" means the order died (rejected/cancelled), so the
// money never needs to move — NOT "payment cancelled".
export const PAYMENT_BADGE: Record<
  PaymentStatus,
  ReturnType<typeof chip> & { note?: string }
> = {
  pending: chip('Belum dibayar', 'warn'),
  paid: chip('Lunas', 'success'),
  voided: {
    ...chip('Dibatalkan', 'neutral'),
    note: 'Pesanan tidak jadi — pembayaran ini tidak perlu dilakukan.',
  },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'COD — bayar di tempat',
  gopay: 'GoPay',
  transfer: 'Transfer Bank',
};
