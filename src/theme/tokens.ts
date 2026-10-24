/**
 * ArchSchool's visual tokens.
 *
 * Direction: a "midnight blueprint" — deep navy paper, hairline drafting grid,
 * one warm signal amber for streaks and deadlines. Glass is reserved for chrome
 * (tab bar, sheets, hero) so long lists stay cheap to scroll on Android.
 */

export const colors = {
  ink: "#05090F",
  inkRaised: "#080E18",
  panel: "#0C1522",
  panelSolid: "#101B2C",
  panelSoft: "rgba(16,27,44,0.66)",
  line: "rgba(148,178,214,0.14)",
  lineStrong: "rgba(148,178,214,0.26)",
  text: "#F2F7FE",
  textSoft: "#C9D7E8",
  muted: "#8CA1BA",
  faint: "#5B7088",
  amber: "#F2B455",
  amberDeep: "#C98A2E",
  amberSoft: "rgba(242,180,85,0.14)",
  amberLine: "rgba(242,180,85,0.35)",
  teal: "#4FD1B5",
  tealSoft: "rgba(79,209,181,0.14)",
  red: "#F2686B",
  redSoft: "rgba(242,104,107,0.14)",
  blue: "#6A9BFF",
  blueSoft: "rgba(106,155,255,0.14)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const gradients = {
  hero: ["#162538", "#0A121E"] as const,
  heroGlow: ["rgba(242,180,85,0.20)", "rgba(242,180,85,0)"] as const,
  screen: ["#08101B", "#05090F"] as const,
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
