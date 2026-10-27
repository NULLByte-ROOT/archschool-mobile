import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { resolveMediaUrl } from "@/api/client";
import { colors, fonts, gradients, radius } from "@/theme/tokens";
import { initials } from "@/lib/format";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type TextVariant =
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "strong"
  | "label"
  | "caption"
  | "number"
  | "numberSm";

const VARIANT_STYLE: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.black, fontSize: 38, lineHeight: 48 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 31 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 23 },
  strong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19 },
  caption: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 18 },
  number: {
    fontFamily: fonts.black,
    fontSize: 34,
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  numberSm: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
};

interface AppTextProps {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: "left" | "right" | "center";
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** RN ellipsis position — used by the profile tiles for long values. */
  ellipsizeMode?: "head" | "middle" | "tail" | "clip";
  /** Force LTR for access codes, room ids and numeric hints. */
  ltr?: boolean;
  onPress?: () => void;
}

export function AppText({
  children,
  variant = "body",
  color = colors.text,
  align,
  style,
  numberOfLines,
  ellipsizeMode,
  ltr = false,
  onPress,
}: AppTextProps) {
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      allowFontScaling
      style={[
        VARIANT_STYLE[variant],
        {
          color,
          textAlign: align ?? (ltr ? "left" : "right"),
          writingDirection: ltr ? "ltr" : "rtl",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const AVATAR_SIZE: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 46,
  lg: 64,
  xl: 92,
};

const AVATAR_FONT: Record<AvatarSize, number> = {
  xs: 12,
  sm: 14,
  md: 17,
  lg: 24,
  xl: 34,
};

export function Avatar({
  name,
  uri,
  size = "md",
  ring = false,
  style,
}: {
  name?: string | null;
  uri?: string | null;
  size?: AvatarSize;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const dimension = AVATAR_SIZE[size];
  const resolved = resolveMediaUrl(uri);
  return (
    <View
      style={[
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: ring ? 1.5 : 1,
          borderColor: ring ? colors.amberLine : colors.line,
        },
        style,
      ]}
    >
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={["#27272a", "#111113"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {!resolved ? (
        <AppText
          variant="strong"
          color={colors.amber}
          style={{ fontFamily: fonts.bold, fontSize: AVATAR_FONT[size] }}
        >
          {initials(name)}
        </AppText>
      ) : null}
    </View>
  );
}

export type PillTone = "amber" | "teal" | "red" | "blue" | "muted";

const PILL_COLORS: Record<PillTone, { bg: string; fg: string; border: string }> = {
  amber: { bg: colors.amberSoft, fg: colors.amber, border: colors.amberLine },
  teal: { bg: colors.tealSoft, fg: colors.teal, border: "rgba(79,209,181,0.32)" },
  red: { bg: colors.redSoft, fg: colors.red, border: "rgba(242,104,107,0.32)" },
  blue: { bg: colors.blueSoft, fg: colors.blue, border: "rgba(106,155,255,0.32)" },
  muted: {
    bg: "rgba(140,161,186,0.10)",
    fg: colors.muted,
    border: "rgba(140,161,186,0.22)",
  },
};

export function Pill({
  label,
  tone = "muted",
  icon,
  style,
}: {
  label: string;
  tone?: PillTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const toneColors = PILL_COLORS[tone];
  return (
    <View
      style={[
        {
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: toneColors.bg,
          borderWidth: 1,
          borderColor: toneColors.border,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={toneColors.fg} /> : null}
      <AppText variant="caption" color={toneColors.fg} style={{ fontFamily: fonts.medium }}>
        {label}
      </AppText>
    </View>
  );
}

export function Badge({
  count,
  tone = "amber",
  style,
}: {
  count: number;
  tone?: "amber" | "red";
  style?: StyleProp<ViewStyle>;
}) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <View
      style={[
        {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone === "red" ? colors.red : colors.amber,
        },
        style,
      ]}
    >
      <AppText
        variant="caption"
        color="#140D02"
        style={{ fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14 }}
        ltr
      >
        {display}
      </AppText>
    </View>
  );
}

export function IconBubble({
  name,
  tone = "amber",
  size = 38,
}: {
  name: IconName;
  tone?: PillTone;
  size?: number;
}) {
  const toneColors = PILL_COLORS[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: toneColors.bg,
        borderWidth: 1,
        borderColor: toneColors.border,
      }}
    >
      <Ionicons name={name} size={size * 0.46} color={toneColors.fg} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, width: "100%" },
        style,
      ]}
    />
  );
}
