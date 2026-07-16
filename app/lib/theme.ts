// Shared design tokens — "cheerful, warm, easy to understand for any age".
// Every screen imports from here instead of hard-coding hex values.
// Cheer = warm sunny surfaces + rounder shapes + one happy accent (sunny yellow),
// NOT many colors. All text pairs meet WCAG AA (see ratios in lib/theme notes).

export const colors = {
  // Surfaces — warm & sunny
  bg: '#fff9f0', // sunny cream — the whole app sits on this
  card: '#ffffff',
  border: '#efe7db', // warm hairline border for cards
  inputBorder: '#d8cfbf',

  // Text — warm near-black + AA-safe grays
  text: '#26302b', // titles & primary copy (~13:1 on bg)
  body: '#4f5b54', // body text (~7:1)
  secondary: '#5c655f', // secondary/meta text (~5.6:1 — AA)

  // Brand green — `primary` is a FILL that carries white text at 4.95:1
  primary: '#0d8143', // button fills
  primaryDark: '#0a6535', // pressed state / green text on light
  primaryDeep: '#063d20', // deepest green — chip & badge text (AA on light green)
  primarySoft: '#eafaf0', // soft green fill for outline buttons
  primaryChipBg: '#d6f5e0', // green chip/badge background
  primaryChipBorder: '#8fe3ab',
  disabled: '#a9cdb8', // disabled state of the primary button

  // Bright brand accent — lively green for GRAPHICS only (not small text)
  primaryBright: '#22c55e', // active timeline dot, highlight rings, icon circles

  // Sunny yellow — the "cheer" accent
  sunny: '#ffc233', // voice-button accent, favorite highlight, celebration
  sunnyBg: '#fff4d1', // soft sunny fill for celebratory banners / empty states
  sunnyText: '#7a4f00', // dark bold text ON sunny / sunnyBg

  // Warm amber accents
  amber: '#f59e0b',
  amberBorder: '#fbbf24',
  amberBg: '#fff3d0',
  amberText: '#8a4b00', // darkened for AA on amberBg
  amberSoft: '#fffaeb',
  amberSoftBorder: '#f6cf4d',

  // Danger
  danger: '#dc2626',
  dangerDark: '#b42318',
  dangerBg: '#fdecea',
  dangerBorder: '#f6c9c4',

  // Informational (status chips)
  info: '#1e40af',
  infoBg: '#dbeafe',
  teal: '#0f766e',
  tealBg: '#ccfbf1',
  neutralBg: '#f4f1ea', // warm neutral

  white: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32, // section separation, breathing room
} as const;

export const radius = {
  sm: 12, // rounder = friendlier
  md: 16,
  lg: 20,
  xl: 28, // hero voice button & feature cards
  pill: 999,
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
