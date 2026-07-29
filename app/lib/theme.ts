// ─────────────────────────────────────────────────────────────────────────
// NgomongAja design tokens — "Oranye Hangat".
//
// The rules this file encodes:
//   • FIVE named hues, each with exactly one job:
//       Oranye hangat #F2811D  → brand, logo, primary CTA
//       Biru percaya  #1B5FA8  → links and icons (token: `link`)
//       Navy tinta    #10233D  → all text (token: `text`)
//       Krem lembut   #FFF6EA  → the page (token: `bg`)
//       Toska aktif   #17B891  → success / online (token: `success`)
//     Plus gold for "needs attention" and red for destructive.
//
//   • ORANGE IS A FILL, NEVER TEXT. #F2811D on cream is 2.47:1 — it fails
//     badly as type. Orange type uses `primaryInk` (6.68:1). Same trap with
//     toska: `success` is a fill/dot, `successInk` is the text.
//
//   • Text on an orange fill is NAVY, not white. White on #F2811D is
//     2.65:1; navy is 5.97:1. Getting white to pass would mean darkening
//     the fill to a muddy #B35E0B, which loses the warmth entirely.
//
//   • Orange (28°), gold (46°) and red (4°) are all warm and blur together
//     on a phone in sunlight. So they are NOT distinguished by hue alone —
//     they are distinguished by FORM:
//       CTA       = solid fill
//       warn      = pale tint + left rule + icon, never a fill
//       destructive = outline + red label, never a fill
//     And every one of them also carries a word.
//
//   • Plus Jakarta Sans carries headings and buttons; Inter carries body,
//     transcripts and interface text. Nothing else.
//   • Body copy floor is 16px, meta floor is 14px, nothing below 13px.
//     Our users are 40+ warung owners reading outdoors.
//   • Every foreground/background pair below is WCAG 2.1 AA verified.
//     The ratio in each comment is measured, not estimated.
// ─────────────────────────────────────────────────────────────────────────

import { StyleSheet, type TextStyle } from 'react-native';

export const colors = {
  // ── Surfaces: Krem lembut ──────────────────────────────────────────────
  bg: '#FFF6EA', // Krem lembut — the whole app sits on this
  card: '#FFFFFF', // raised surface: white on cream, no border, no shadow
  neutralBg: '#F2E9DA', // segmented tracks, neutral chips, disabled fills
  border: '#EADFCB', // DECORATIVE hairline only (1.23:1) — never the sole signal
  inputBorder: '#8B8375', // a real, perceivable control outline (3.75:1 on card)

  // ── Ink: Navy tinta ────────────────────────────────────────────────────
  text: '#10233D', // Navy tinta — headings, row titles, values (14.76:1)
  body: '#3D4A5C', // default body copy (8.41:1)
  secondary: '#5A6675', // meta, timestamps, placeholders (5.46:1)
  // NOTE: `secondary` is META INK, not the palette's "Secondary" blue.
  // The blue lives in `link` below. Do not conflate them.

  // ── Oranye hangat: brand + CTA. A FILL, never type. ───────────────────
  primary: '#F2811D', // solid fills ONLY (2.47:1 as text — unusable)
  primaryDark: '#D96F12', // PRESSED fill only — never a text colour
  primaryInk: '#8A4508', // orange TEXT on paper or on primarySoft (6.68:1)
  primarySoft: '#FDEBD8', // the ONE orange tint (chips, secondary buttons)
  primarySoftPressed: '#FADCBD',
  onPrimary: '#10233D', // navy text/icons on an orange fill (5.97:1)
  onPrimarySoft: '#3A2C1A', // secondary text on an orange fill (5.10:1)

  // ── Biru percaya: links, icons, logo rule. ────────────────────────────
  link: '#1B5FA8', // link text on paper (6.04:1); white on it is 6.46:1
  linkInk: '#164E8A', // pressed / text on linkSoft (7.18:1)
  linkSoft: '#E4EEF8', // the ONE blue tint (assistive buttons)
  linkSoftPressed: '#D3E4F4',

  // ── Toska aktif: success / online. Also a fill, never type. ───────────
  success: '#17B891', // the dot / fill (2.36:1 as text — unusable)
  successInk: '#0E7A5F', // success TEXT (4.95:1 on paper)
  successBg: '#DFF5EE',

  // ── Gold: "needs attention". Tint + ink + rule. Never a solid fill. ───
  warnBg: '#FDF3D0',
  warnInk: '#8A6A00', // also the left accent rule; 4.74:1 on paper

  // ── Merah Perhatian: belum bayar, ditolak, stok habis. ───────────────
  // Status only, never a brand colour. Like orange and toska it is a FILL:
  // #D64545 as text is 4.09:1 on cream, so labels use dangerInk instead.
  danger: '#D64545', // fills, icons, borders, the destructive outline
  dangerInk: '#BF3434', // the TEXT colour (5.22:1 on cream, 5.59:1 white on it)
  dangerPressed: '#A82828',
  dangerBg: '#FBE9E9',

  disabled: '#F2E9DA', // neutral, not a pale orange — "off", not "faded go"
  white: '#FFFFFF',
  shadow: '#10233D', // navy shadow; one recipe only: elevation.raised
} as const;

// ── Type ────────────────────────────────────────────────────────────────
// Plus Jakarta Sans carries headings and buttons — drawn in Jakarta, which is
// the point. Inter carries body, transcripts and interface text.
export const fonts = {
  displayBold: 'PlusJakartaSans_700Bold', // big numbers and money only
  display: 'PlusJakartaSans_600SemiBold', // titles and buttons
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
} as const;

// Screens should never reach for `fonts` directly — use <Text variant="…">,
// which reads from this table. That is what keeps the type scale honest.
export const typography = {
  /** Big numbers only: recap omzet, the record timer, the pay amount. */
  displayXl: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
  },
  /** Exactly ONE per screen: the screen title. -2% tracking per the brand sheet. */
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  /** Card titles, store names, section headings. */
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 28 },
  subtitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 24 },
  /** Default body copy. 16px floor, 1.6 line-height. */
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 26 },
  /**
   * What we heard you say. Deliberately larger than body: this is the one
   * thing people re-read to check we got it right.
   */
  transcript: { fontFamily: fonts.body, fontSize: 18, lineHeight: 29 },
  /** Button labels. Plus Jakarta Sans 600, min 48dp touch target. */
  button: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22 },
  /** Field labels and section labels. Sentence case, no uppercase tracking. */
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  /** The only sub-14px style, and only where the info is repeated in text. */
  tag: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16 },
  /** Rupiah. tabular-nums so columns of money actually line up. */
  money: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

// ── Space ───────────────────────────────────────────────────────────────
// Values unchanged — the fix is that components now actually use them
// instead of hardcoding 13, 17, 22, 26, 27…
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ── Radius ──────────────────────────────────────────────────────────────
// Tighter than before. When everything is a pill, nothing reads as a
// surface — only as a blob.
export const radius = {
  xs: 6, // chips, tags, thumbnails
  sm: 10, // buttons, inputs, small cards
  md: 14, // cards, sheets, banners
  pill: 999, // ONLY genuinely circular things: avatars, the mic, icon buttons
} as const;

export const layout = {
  gutter: 20, // screen horizontal padding (was 24)
  maxContentWidth: 560, // tablet / unfolded content column cap
  minTouch: 48, // Material minimum — our audience skews older than iOS 44
  ctaHeight: 56, // full-width primary buttons
  rowHeight: 56, // use as minHeight, NEVER height (font scaling clips)
  hairline: StyleSheet.hairlineWidth,
} as const;

/**
 * The screen gutter for a given width. Entry-level Android at 360dp is the
 * realistic majority device here, so it gets a tighter gutter rather than
 * being treated as an edge case. Exported so full-bleed elements (the auth
 * dome) can cancel it with a negative margin and stay in sync with <Screen>.
 */
export const gutterFor = (width: number) => (width <= 360 ? spacing.lg : layout.gutter);

// ── Elevation: TWO recipes. Everything else is flat. ────────────────────
// A shadow on warm paper reads as a smudge, not as lift — so it is spent
// only where it earns its place: the mic (the app's most important control)
// and the auth medallion (where the shadow is the only thing separating a
// cream circle from a cream page). Nothing else gets one.
export const elevation = {
  none: {},
  /** The mic control, and nothing else. */
  raised: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  /**
   * The auth medallion, and nothing else. It is the one element whose fill
   * (colors.bg) is identical to the surface behind it, so without a shadow
   * its lower half has literally no edge — 1.00:1. Stronger than `raised`
   * because here the shadow IS the boundary, not just lift.
   */
  medallion: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  /** Sticky footers/headers separate with a hairline, not a shadow. */
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
} as const;

// Screen containers used to live here as `screenWrap` / `scrollWrap`. They
// are gone: <Screen> in components/ui owns the gutter, the paper background,
// safe-area insets, keyboard avoidance, and the tablet content cap.
