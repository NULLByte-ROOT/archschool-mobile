/**
 * ArchSchool's visual tokens — exact mirror of the web theme.
 *
 * Source of truth: `frontend/src/index.css` (`@theme` block) plus the
 * `@media (max-width: 768px)` overrides that decide how the web actually looks
 * on a phone:
 *
 *   .panel / .glass  ->  rgba(9,9,14,0.92), 1px rgba(255,255,255,0.08),
 *                        no shadow, no backdrop blur, no noise
 *
 * Every colour below is copied from that file. Do not invent new hues: the web
 * palette is true-black surfaces, white/monochrome accent, amber only for
 * streaks/medals/warnings and emerald only for success/breaks.
 */

export const colors = {
  /* ---------- surfaces (web: bg-50 … bg-700) ---------- */
  ink: "#000000", // bg-50 / body
  inkRaised: "#060608", // bg-100 / sheets
  panel: "#0b0b0f", // bg-200
  panelSolid: "#131318", // bg-300
  panelDeep: "#1b1b21", // bg-400
  /** The phone `.panel` background (web media query). */
  panelPhone: "rgba(9,9,14,0.92)",
  /** The desktop `.panel` background — used only for floating glass. */
  panelGlass: "rgba(12,12,16,0.82)",

  /* ---------- translucency ladder used by the web ---------- */
  white03: "rgba(255,255,255,0.03)",
  white04: "rgba(255,255,255,0.04)",
  white05: "rgba(255,255,255,0.05)",
  white06: "rgba(255,255,255,0.06)",
  white07: "rgba(255,255,255,0.07)",
  white08: "rgba(255,255,255,0.08)",
  white10: "rgba(255,255,255,0.10)",
  white12: "rgba(255,255,255,0.12)",
  white15: "rgba(255,255,255,0.15)",
  white18: "rgba(255,255,255,0.18)",
  panelSoft: "rgba(255,255,255,0.03)",

  /* ---------- borders ---------- */
  /** `.panel` border on the web: rgba(255,255,255,0.08). */
  line: "rgba(255,255,255,0.08)",
  /** chip / input borders on the web: rgba(255,255,255,0.10). */
  lineChip: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.18)",

  /* ---------- text (web: fg-100 … fg-700) ---------- */
  text: "#fafafa", // fg-100
  textSoft: "#d4d4d8", // fg-300
  muted: "#a1a1aa", // fg-700
  faint: "#7c7c86", // fg-500
  bodyCopy: "#ededed", // body colour

  /* ---------- accents ---------- */
  /**
   * Primary accent — the web app's white (`--color-fg-100` / white buttons).
   * `amber*` names are kept as aliases so no screen silently loses its accent
   * after the theme moved from yellow to white.
   */
  accent: "#f4f4f5",
  accentDeep: "#e4e4e7",
  accentSoft: "rgba(255,255,255,0.08)",
  accentLine: "rgba(255,255,255,0.18)",
  /** @deprecated use `accent`; kept for existing screens. */
  amber: "#f4f4f5",
  /** @deprecated use `accentDeep`. */
  amberDeep: "#e4e4e7",
  /** @deprecated use `accentSoft`. */
  amberSoft: "rgba(255,255,255,0.08)",
  /** @deprecated use `accentLine`. */
  amberLine: "rgba(255,255,255,0.18)",
  /** Dark-on-white label colour for filled buttons. */
  onAccent: "#09090b",
  /** orange-400 — the flame in the web streak hero. */
  flame: "#FB923C",
  flameSoft: "rgba(251,146,60,0.15)",
  flameLine: "rgba(251,146,60,0.35)",
  flameText: "#FED7AA",

  success: "#34D399", // web --color-success
  successSoft: "rgba(52,211,153,0.10)",
  successLine: "rgba(52,211,153,0.30)",
  warning: "#FBBF24", // web --color-warning
  danger: "#F87171", // web --color-danger
  dangerSoft: "rgba(248,113,113,0.10)",
  dangerLine: "rgba(248,113,113,0.30)",
  emerald: "#6EE7B7",
  emeraldPale: "#D1FAE5",

  /* aliases kept for the existing screens */
  teal: "#34D399",
  tealSoft: "rgba(52,211,153,0.10)",
  red: "#F87171",
  redSoft: "rgba(248,113,113,0.10)",
  blue: "#7DD3FC", // sky-300 (friend badge on the web)
  blueSoft: "rgba(125,211,252,0.12)",

  white: "#FFFFFF",
  black: "#000000",

  /* ---------- deadline tones (web TONE_*) ---------- */
  dueRed: "#EF4444",
  dueRedText: "#F87171",
  dueRedSoft: "rgba(239,68,68,0.10)",
  dueYellow: "#EAB308",
  dueYellowText: "#FACC15",
  dueYellowSoft: "rgba(234,179,8,0.10)",

  /* ---------- ranks (web leaderboard medals) ---------- */
  rankGold: "#FBBF24",
  rankSilver: "#D4D4D8",
  rankBronze: "#C98455",

  /* ---------- streak hero (web) ---------- */
  heroRiskBg: "#140607",
  heroCalmBg: "#0d0805",
  heroRiskLine: "rgba(239,68,68,0.45)",
  heroCalmLine: "rgba(249,115,22,0.30)",
} as const;

export const gradients = {
  hero: ["#18181b", "#050506"] as const,
  heroGlow: ["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"] as const,
  screen: ["#000000", "#000000"] as const,
  /** Primary button: white -> zinc-200 (dark label on top). */
  amber: ["#ffffff", "#e4e4e7"] as const,
  whiteButton: ["#ffffff", "#e4e4e7"] as const,
  flame: ["#FB923C", "#F97316"] as const,
  danger: ["#F87171", "#B73B4B"] as const,
  /** The web streak number: #fafafa -> #fef3c7 -> #fb923c. */
  streakNumber: ["#fafafa", "#fef3c7", "#fb923c"] as const,
  /** `مسیر` fill of the web class-completion bar. */
  progress: ["#34d399", "#6ee7b7", "#d1fae5"] as const,
  whiteTile: ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.02)"] as const,
} as const;

export const fonts = {
  regular: "Vazirmatn_400Regular",
  medium: "Vazirmatn_500Medium",
  semibold: "Vazirmatn_600SemiBold",
  bold: "Vazirmatn_700Bold",
  black: "Vazirmatn_900Black",
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16, // web `.panel`
  lg: 24, // web `rounded-3xl`
  xl: 28, // web hero / bottom sheets
  pill: 999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 44,
} as const;

/** The web renders page content with `p-4` on a phone. */
export const screenGutter = 16;

/** Floating glass tab bar geometry (content must reserve this much space). */
export const tabBarHeight = 62;
export const tabBarMargin = 16;
export const tabBarFloatOffset = 10;
/** Total space a scrolling screen must leave at the bottom. */
export const tabBarReserve = tabBarHeight + tabBarMargin;

export const shadows = {
  card: "0px 18px 38px -26px rgba(0,0,0,0.95)",
  lift: "0px 24px 48px -22px rgba(0,0,0,0.9)",
  /** No accent glow: the web keeps flat surfaces on phones. */
  amber: "0px 18px 38px -26px rgba(0,0,0,0.95)",
  /** Floating glass pill: soft drop shadow, iOS-26 style. */
  glass: "0px 18px 44px -12px rgba(0,0,0,0.85)",
} as const;
