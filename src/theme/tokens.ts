/**
 * ArchSchool's visual tokens.
 *
 * Mirrors the web app: true-black paper, neutral graphite panels and
 * `rgba(255,255,255,0.03)` glass. Amber stays as the single warm signal for
 * streaks/deadlines; everything else is monochrome.
 */

export const colors = {
  ink: "#000000",
  inkRaised: "#060608",
  panel: "#0b0b0f",
  panelSolid: "#131318",
  panelSoft: "rgba(255,255,255,0.035)",
  line: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.18)",
  text: "#fafafa",
  textSoft: "#d4d4d8",
  muted: "#a1a1aa",
  faint: "#71717a",
  amber: "#F2B455",
  amberDeep: "#C98A2E",
  amberSoft: "rgba(242,180,85,0.12)",
  amberLine: "rgba(242,180,85,0.32)",
  teal: "#4FD1B5",
  tealSoft: "rgba(79,209,181,0.12)",
  red: "#F2686B",
  redSoft: "rgba(242,104,107,0.12)",
  blue: "#8AB4FF",
  blueSoft: "rgba(138,180,255,0.12)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const gradients = {
  hero: ["#18181b", "#050506"] as const,
  heroGlow: ["rgba(242,180,85,0.18)", "rgba(242,180,85,0)"] as const,
  screen: ["#09090b", "#000000"] as const,
  amber: ["#F7C978", "#E8A53C"] as const,
  danger: ["#F2686B", "#B73B4B"] as const,
};

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
  md: 18,
  lg: 24,
  xl: 30,
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

export const screenGutter = 20;
export const tabBarHeight = 64;

export const shadows = {
  card: "0px 18px 38px -26px rgba(0,0,0,0.95)",
  lift: "0px 24px 48px -22px rgba(0,0,0,0.9)",
  amber: "0px 10px 30px -12px rgba(242,180,85,0.45)",
} as const;
