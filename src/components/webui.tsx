/**
 * Primitives that mirror the web app's phone layout 1:1.
 *
 * Every value here is copied from `frontend/src/index.css` + the Tailwind
 * classes the web uses at <640px:
 *
 *   .panel      -> rgba(9,9,14,0.92) + 1px rgba(255,255,255,0.08), radius 16
 *   .badge      -> pill, mono 10px, tracking .14em, uppercase, #d4d4d8
 *   .mono-label -> mono 10px, tracking .18em, uppercase, #7c7c86
 *   .dot        -> 6px white circle with a white glow
 *   Corners     -> four 8x8 brackets, 12px inset, 1px rgba(255,255,255,0.20)
 *
 * The web's JetBrains Mono is not bundled in the app, so "mono" here means
 * Vazirmatn + tabular nums + wide tracking: same rhythm, one font family.
 */

import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppText, type IconName } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

export const mono = {
  fontFamily: fonts.medium,
  letterSpacing: 1.4,
  fontVariant: ["tabular-nums" as const],
};

export function Corners({ tone = "rgba(255,255,255,0.20)" }: { tone?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[st.corner, st.tl, { borderColor: tone }]} />
      <View style={[st.corner, st.tr, { borderColor: tone }]} />
      <View style={[st.corner, st.bl, { borderColor: tone }]} />
      <View style={[st.corner, st.br, { borderColor: tone }]} />
    </View>
  );
}

/** The web `.panel`. */
export function Panel({
  children,
  style,
  contentStyle,
  corners = false,
  cornerTone,
  onPress,
  haptic = false,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  corners?: boolean;
  cornerTone?: string;
  onPress?: () => void;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <View style={[st.panel, style]}>
      {corners ? <Corners tone={cornerTone} /> : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: "rgba(255,255,255,0.04)" }}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function MonoLabel({
  children,
  tone = colors.faint,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: StyleProp<React.ComponentProps<typeof AppText>["style"]>;
}) {
  return (
    <AppText
      color={tone}
      style={[
        {
          fontFamily: fonts.medium,
          fontSize: 10,
          lineHeight: 14,
          letterSpacing: 1.6,
        },
        style,
      ]}
    >
      {children}
    </AppText>
  );
}

/** The web `.badge` — pill with optional pulsing white dot. */
export function Kicker({
  text,
  dot = false,
  style,
}: {
  text: string;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.badge, style]}>
      {dot ? <PulseDot /> : null}
      <AppText
        numberOfLines={1}
        color={colors.textSoft}
        style={{
          fontFamily: fonts.medium,
          fontSize: 10,
          lineHeight: 14,
          letterSpacing: 1.4,
        }}
      >
        {text.toUpperCase()}
      </AppText>
    </View>
  );
}

export function PulseDot({ size = 6, tone = colors.white, glow = true }: { size?: number; tone?: string; glow?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
        boxShadow: glow ? `0px 0px 8px ${tone}` : undefined,
      }}
    />
  );
}

/** 36x36 icon tile used by every panel header on the web. */
export function IconTile({
  name,
  size = 36,
  iconSize = 16,
  tone = colors.white,
  border = colors.white12,
  background = colors.white05,
  onPress,
}: {
  name: IconName;
  size?: number;
  iconSize?: number;
  tone?: string;
  border?: string;
  background?: string;
  onPress?: () => void;
}) {
  const tile = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 44 ? 16 : 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: border,
        backgroundColor: background,
      }}
    >
      <Ionicons name={name} size={iconSize} color={tone} />
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      {tile}
    </Pressable>
  );
}

/** `// LABEL` + title + trailing accessory, exactly like the web panels. */
export function PanelHeader({
  label,
  title,
  icon,
  iconTone,
  iconBorder,
  iconBackground,
  accessory,
  style,
}: {
  label: string;
  title: string;
  icon?: IconName;
  iconTone?: string;
  iconBorder?: string;
  iconBackground?: string;
  accessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.panelHeader, style]}>
      <View style={st.panelHeaderRight}>
        {icon ? (
          <IconTile
            name={icon}
            tone={iconTone ?? colors.white}
            border={iconBorder}
            background={iconBackground}
          />
        ) : null}
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <MonoLabel>{label}</MonoLabel>
          <AppText
            numberOfLines={1}
            style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}
          >
            {title}
          </AppText>
        </View>
      </View>
      {accessory}
    </View>
  );
}

/** The 3-up micro stat used inside `وضعیت کلی کلاس` and `تمرکز من`. */
export function MiniStat({
  icon,
  label,
  value,
  tone,
  style,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[st.miniStat, style]}>
      <View style={st.miniStatIcon}>
        <Ionicons name={icon} size={12} color={colors.faint} />
      </View>
      <AppText
        align="center"
        color={tone ?? colors.white}
        style={{
          fontFamily: fonts.black,
          fontSize: 16,
          lineHeight: 22,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </AppText>
      <AppText align="center" color={colors.faint} style={{ fontSize: 9, lineHeight: 13 }}>
        {label}
      </AppText>
    </View>
  );
}

const st = StyleSheet.create({
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: colors.panelPhone,
    overflow: "hidden",
  },
  corner: { position: "absolute", width: 8, height: 8, borderWidth: 1 },
  tl: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  tr: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  br: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  panelHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 16,
  },
  panelHeaderRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  miniStatIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
  },
});
