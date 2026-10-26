/**
 * Chat-only "liquid glass" primitives.
 *
 * These are deliberately local to the chat surfaces: the rest of the app keeps
 * the web-mirroring `Panel` look from `webui.tsx`. Everything here is built from
 * tokens (`colors`, `radius`, `fonts`) and from packages already in the binary
 * (expo-blur, expo-haptics, reanimated) so the whole redesign ships over OTA.
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

/** True-black chat canvas behind every card. */
export const chatCanvas = colors.black;

/**
 * Blurred, hairline-bordered surface.
 *
 * Android only blurs on API 31+, so a translucent tint is layered underneath:
 * the surface stays readable on older devices instead of turning transparent.
 * The lifted sheen line is what makes it read as glass rather than a grey box.
 */
export function GlassSurface({
  children,
  style,
  contentStyle,
  intensity = 40,
  tint = "systemChromeMaterialDark",
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: "systemChromeMaterialDark" | "dark" | "default";
}) {
  return (
    <View style={[styles.glass, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        blurMethod="dimezisBlurViewSdk31Plus"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glassTint} />
      <View pointerEvents="none" style={styles.glassSheen} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

/** `// SECTION` eyebrow — mono caps above a Persian title. */
export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<React.ComponentProps<typeof AppText>["style"]>;
}) {
  return (
    <AppText
      ltr
      numberOfLines={1}
      color={colors.faint}
      style={[
        {
          fontFamily: fonts.medium,
          fontSize: 9.5,
          lineHeight: 14,
          letterSpacing: 1.7,
          textAlign: "right",
        },
        style,
      ]}
    >
      {children}
    </AppText>
  );
}

/** White pill, black digits — the one element that must always pop. */
export function UnreadPill({
  count,
  size = 22,
  style,
}: {
  count: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <View
      style={[
        {
          minWidth: size,
          height: size,
          paddingHorizontal: 6,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.white,
        },
        style,
      ]}
    >
      <AppText
        ltr
        color={colors.black}
        style={{
          fontFamily: fonts.bold,
          fontSize: 11,
          lineHeight: 15,
          fontVariant: ["tabular-nums"],
        }}
      >
        {display}
      </AppText>
    </View>
  );
}

/** Exact stagger from the design brief: +30ms per card, 250ms, 12px rise. */
export function Entrance({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      Math.max(0, index) * 30,
      withTiming(1, { duration: 250 })
    );
  }, [index, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Floating card: `white/3` fill, `white/8` hairline, 18px radius.
 *
 * Press shrinks to 0.98, brightens by 6% and fires a light haptic — no glow, no
 * spring, so a long list still feels calm.
 */
export function ChatCard({
  children,
  onPress,
  onLongPress,
  index = 0,
  style,
  accessibilityLabel,
  haptic = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  index?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: boolean;
}) {
  const press = useSharedValue(0);

  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.02 }],
  }));

  const brighten = useAnimatedStyle(() => ({
    opacity: press.value * 0.06,
  }));

  return (
    <Entrance index={index}>
      <Animated.View style={[styles.card, style, scale]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.white },
            brighten,
          ]}
        />
        <Pressable
          onPressIn={() => {
            press.value = withTiming(1, { duration: 90 });
            if (haptic) {
              void Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Light
              ).catch(() => undefined);
            }
          }}
          onPressOut={() => {
            press.value = withTiming(0, { duration: 140 });
          }}
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={styles.cardPress}
        >
          {children}
        </Pressable>
      </Animated.View>
    </Entrance>
  );
}

/** 6px presence dot. Green = the backend's two-minute "online" window. */
export function StatusDot({
  tone = colors.success,
  size = 6,
}: {
  tone?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
      }}
    />
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    backgroundColor: "rgba(8,8,11,0.55)",
  },
  glassTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,11,0.34)",
  },
  glassSheen: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    overflow: "hidden",
  },
  cardPress: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 76,
  },
});
