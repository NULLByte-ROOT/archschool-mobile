import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AppText, IconName } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/theme/tokens";

export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  haptic = "light",
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: "light" | "selection" | "none";
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.975, { damping: 20, stiffness: 320 });
          if (haptic !== "none") {
            const promise =
              haptic === "selection"
                ? Haptics.selectionAsync()
                : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void promise.catch(() => undefined);
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 260 });
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        android_ripple={{ color: "rgba(255,255,255,0.05)" }}
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function GlassCard({
  children,
  style,
  contentStyle,
  glow = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  glow?: boolean;
}) {
  return (
    <View
      style={[
        styles.glass,
        { borderColor: glow ? colors.amberLine : "rgba(255,255,255,0.08)" },
        glow ? { boxShadow: shadows.amber } : null,
        style,
      ]}
    >
      <View style={[styles.glassContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function SolidCard({
  children,
  style,
  onPress,
  onLongPress,
  haptic,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  haptic?: "light" | "selection" | "none";
}) {
  const card = (
    <View style={[styles.solid, style]}>
      <View style={styles.solidSheen} pointerEvents="none" />
      {children}
    </View>
  );
  if (!onPress && !onLongPress) return card;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      haptic={haptic}
      style={style ? undefined : undefined}
    >
      {card}
    </PressableScale>
  );
}

export function SectionTitle({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionText}>
        <AppText variant="subtitle">{title}</AppText>
        {hint ? (
          <AppText variant="caption" color={colors.muted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync().catch(() => undefined);
            onAction();
          }}
          hitSlop={10}
          style={styles.action}
        >
          <AppText variant="label" color={colors.amber} style={{ fontFamily: "Vazirmatn_600SemiBold" }}>
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-back" size={13} color={colors.amber} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = colors.amber,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tile, style]}>
      {icon ? (
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={13} color={tone} />
        </View>
      ) : null}
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
      <AppText variant="numberSm" color={colors.text} style={{ fontSize: 21 }}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" color={colors.faint} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  hint,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: spacing.lg }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.amber} />
      </View>
      <AppText variant="strong" align="center">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="caption" color={colors.muted} align="center" style={{ maxWidth: 260 }}>
          {hint}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ marginTop: spacing.xs }}>
          <AppText variant="label" color={colors.amber}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingScreen({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.amber} size="small" />
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

export function SkeletonRows({ count = 3, height = 74 }: { count?: number; height?: number }) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 850 }), withTiming(0.45, { duration: 850 })),
      -1,
      true
    );
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            {
              height,
              borderRadius: radius.md,
              backgroundColor: colors.panel,
              borderWidth: 1,
              borderColor: colors.line,
            },
            animatedStyle,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors the web `.panel` on pointer-coarse screens: near-opaque graphite,
  // 1px white/8 border, 16px radius and no backdrop blur (the web disables
  // glassmorphism on mobile for performance as well).
  glass: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "rgba(9,9,14,0.92)",
  },
  glassContent: { padding: spacing.md },
  solid: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(9,9,14,0.92)",
    overflow: "hidden",
    boxShadow: shadows.card,
  },
  solidSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sectionRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionText: { flex: 1, gap: 1 },
  action: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    paddingBottom: 2,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  tileIcon: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
  },
  empty: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
    marginBottom: spacing.xs,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
