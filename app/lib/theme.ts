// Shared design tokens — "Hijau Rupiah" from the approved Claude Design project
// (NgomongAja.dc.html, sections 2a + 4a in palette 3a).
// Language: warm paper surfaces, deep rupiah green, orange accent,
// Caprasimo display type + Figtree body, pill buttons, borderless cards.

export const colors = {
  // Surfaces — warm paper
  bg: '#fbf7ec', // paper — the whole app sits on this
  card: '#efe8d3', // warm surface — cards sit on paper WITHOUT borders
  border: '#ded5c3', // hairline (≈16% ink over paper)
  inputBorder: '#ded5c3',

  // Text — warm ink + neutral ramp
  text: '#201e1d',
  body: '#645c50', // neutral-700
  secondary: '#82796a', // neutral-600 (meta text)

  // Rupiah green (accent-2 ramp)
  primary: '#0c8f43', // fills; paper/white text on top
  primaryDark: '#0a7437', // pressed (600)
  primaryDeep: '#05431f', // deepest green text (800)
  primarySoft: '#e0f7e7', // green-100 soft fill
  primaryChipBg: '#c0edd0', // green-200 chip/badge background
  primaryChipBorder: '#8fdcaa', // green-300
  primaryBright: '#0c8f43', // graphics accent (same as primary in this palette)
  disabled: '#9fceb2',

  // Orange accent (accent ramp) — notices, "Tutup"/"Habis", payment-pending
  sunny: '#f08c00',
  sunnyBg: '#fff0d8', // accent-100
  sunnyText: '#784200', // accent-800
  amber: '#f08c00',
  amberBorder: '#ffc670', // accent-300
  amberBg: '#fff0d8', // accent-100
  amberText: '#784200', // accent-800
  amberSoft: '#fff0d8',
  amberSoftBorder: '#ffc670',

  // Danger (kept — the design has no destructive ramp)
  danger: '#dc2626',
  dangerDark: '#b42318',
  dangerBg: '#fdecea',
  dangerBorder: '#f6c9c4',

  // Informational (status chips)
  info: '#1e40af',
  infoBg: '#dbeafe',
  teal: '#0f766e',
  tealBg: '#ccfbf1',
  neutralBg: '#eee7db', // neutral-200 warm

  white: '#ffffff',
  onPrimary: '#fbf7ec', // paper text on green fills (per the design)
} as const;

// Type — Caprasimo carries titles, buttons, and big numbers; Figtree the rest.
export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 14,
  md: 18, // thumbnails, small cards
  lg: 24, // list cards
  xl: 28, // hero cards
  pill: 999, // every button and input
} as const;

// Shared screen container. Screens add `paddingTop: insets.top + 12`
// from useSafeAreaInsets() so content clears the notch/status bar.
export const screenWrap = {
  flex: 1,
  padding: spacing.xl,
  backgroundColor: colors.bg,
} as const;

// Same pattern for ScrollView contentContainerStyle (flexGrow, not flex).
export const scrollWrap = {
  flexGrow: 1,
  padding: spacing.xl,
  backgroundColor: colors.bg,
} as const;
