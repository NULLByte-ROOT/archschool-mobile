import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { fetchUnread, qk } from "@/api/client";
import { AppText, Badge, type IconName } from "@/components/ui";
import {
  colors,
  fonts,
  radius,
  shadows,
  tabBarFloatOffset,
  tabBarHeight,
  tabBarMargin,
} from "@/theme/tokens";

/**
 * Floating "liquid glass" tab bar (iOS 26 style).
 *
 * The web's mobile shell has no tab bar at all, so this is the one surface that
 * is intentionally *not* a web port: a floating pill, blurred backdrop, hairline
 * border, soft shadow, 26px icons with a 10.5px label and an amber active
 * capsule. Geometry lives in `theme/tokens.ts` so every screen can reserve the
 * same amount of space at the bottom.
 */

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "لیدر بورد", icon: "podium-outline", activeIcon: "podium" },
  profile: { label: "پروفایل", icon: "person-circle-outline", activeIcon: "person-circle" },
};

function TabItem({
  routeName,
  focused,
  badge,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  badge: number;
  onPress: () => void;
}) {
  const meta = TABS[routeName] ?? {
    label: routeName,
    icon: "ellipse-outline" as IconName,
    activeIcon: "ellipse" as IconName,
  };

  // One shared value drives both the capsule fade and the icon lift.
  const progress = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 190 });
  }, [focused, progress]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.74 + progress.value * 0.26 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * (1 + progress.value * 0.04) },
      { translateY: -(progress.value * 1.5) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.68 + progress.value * 0.32,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.9, { damping: 20, stiffness: 420 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={styles.item}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
    >
      <View style={styles.iconSlot}>
        {/* filled capsule behind the active icon */}
        <Animated.View style={[styles.capsule, capsuleStyle]} pointerEvents="none" />
        <Animated.View style={iconStyle}>
          <Ionicons
            name={focused ? meta.activeIcon : meta.icon}
            size={focused ? 26 : 24}
            color={focused ? colors.amber : colors.faint}
          />
        </Animated.View>
        {badge > 0 && !focused ? <Badge count={badge} style={styles.badge} /> : null}
      </View>

      <Animated.View style={labelStyle}>
        <AppText
          variant="caption"
          color={focused ? colors.amber : colors.faint}
          align="center"
          style={{
            fontFamily: focused ? fonts.semibold : fonts.medium,
            fontSize: 10.5,
            lineHeight: 14,
          }}
        >
          {meta.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { data } = useQuery({
    queryKey: qk.unread,
    queryFn: fetchUnread,
    refetchInterval: 45000,
    staleTime: 15000,
  });
  const chatBadge = data?.total ?? 0;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, tabBarFloatOffset) },
      ]}
    >
      <View style={styles.pill}>
        <BlurView
          intensity={48}
          tint="systemChromeMaterialDark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        {/* Fallback tint: keeps the glass readable if the platform can't blur. */}
        <View style={styles.pillTint} pointerEvents="none" />
        {/* Top inner highlight — the "liquid" sheen. */}
        <View style={styles.sheen} pointerEvents="none" />

        <View style={styles.items}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                badge={route.name === "chat" ? chatBadge : 0}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  const event = emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigateToTab(route.key);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tabBarMargin,
  },
  pill: {
    height: tabBarHeight,
    borderRadius: tabBarHeight / 2,
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: "rgba(10,10,14,0.62)",
    overflow: "hidden",
    boxShadow: shadows.glass,
  },
  pillTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,11,0.42)",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  items: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  iconSlot: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  capsule: {
    position: "absolute",
    width: 44,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: "rgba(251,191,36,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.30)",
  },
  badge: { position: "absolute", top: -3, right: 2 },
});
