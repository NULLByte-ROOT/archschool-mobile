import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState, type ReactNode } from "react";
import { Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { fetchUnread, qk } from "@/api/client";
import { AppText, Badge, type IconName } from "@/components/ui";
import {
  colors,
  fonts,
  shadows,
  tabBarFloatOffset,
  tabBarHeight,
  tabBarMargin,
} from "@/theme/tokens";

/**
 * High-performance liquid glass tab bar for ArchSchool.
 *
 * Designed for rock-solid stability and butter-smooth spring transitions
 * on Android and iOS. Eliminates gesture-fighting and layout shifts.
 */

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "لیدر بورد", icon: "podium-outline", activeIcon: "podium" },
  profile: { label: "پروفایل", icon: "person-circle-outline", activeIcon: "person-circle" },
};

const LOZENGE_TOP = 6;
const LOZENGE_HEIGHT = tabBarHeight - LOZENGE_TOP * 2; // 64 - 12 = 52px
const PADDING_H = 6;

/** Snappy, natural spring for the tab selection bubble */
const SPRING = { damping: 24, stiffness: 280, mass: 0.8 } as const;

function TabItem({
  routeName,
  focused,
  badge,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  badge?: ReactNode;
  onPress: () => void;
}) {
  const meta = TABS[routeName] ?? {
    label: routeName,
    icon: "ellipse-outline" as IconName,
    activeIcon: "ellipse" as IconName,
  };

  const press = useSharedValue(1);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * (focused ? 1.06 : 1) },
      { translateY: focused ? -1 : 0 },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: focused ? 1 : 0.65,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.92, { damping: 18, stiffness: 350 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 18, stiffness: 350 });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={styles.item}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <View style={styles.iconSlot}>
        <Animated.View style={iconStyle}>
          <Ionicons
            name={focused ? meta.activeIcon : meta.icon}
            size={focused ? 26 : 24}
            color={focused ? colors.white : "rgba(255,255,255,0.65)"}
          />
        </Animated.View>
        {badge}
      </View>

      <Animated.View style={labelStyle}>
        <AppText
          variant="caption"
          color={focused ? colors.white : "rgba(255,255,255,0.65)"}
          align="center"
          style={{
            fontFamily: focused ? fonts.semibold : fonts.medium,
            fontSize: 11,
            lineHeight: 15,
          }}
        >
          {meta.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

function ChatTabBadge({ focused }: { focused: boolean }) {
  const { data } = useQuery({
    queryKey: qk.unread,
    queryFn: fetchUnread,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 0,
  });
  const count = data?.total ?? 0;
  if (focused || count <= 0) return null;
  return <Badge count={count} style={styles.badge} />;
}

export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const count = state.routes.length;
  const initialWidth = Dimensions.get("window").width - tabBarMargin * 2;
  const [containerWidth, setContainerWidth] = useState(initialWidth);

  // Available width inside items excluding horizontal padding
  const availableWidth = Math.max(0, containerWidth - PADDING_H * 2);
  const itemWidth = count > 0 ? availableWidth / count : 64;
  // Sized generously around the icon and label
  const bubbleWidth = Math.min(Math.round(itemWidth * 0.94), 72);

  // Compute exact center for the active index in row-reverse (RTL):
  // Index 0 ("home") is at the far right (slot count - 1)
  // Index count - 1 ("profile") is at the far left (slot 0)
  const slotIndex = count - 1 - state.index;
  const slotCenter = PADDING_H + slotIndex * itemWidth + itemWidth / 2;
  const targetX = slotCenter - bubbleWidth / 2;

  const bubbleX = useSharedValue(targetX);

  useEffect(() => {
    bubbleX.value = withSpring(targetX, SPRING);
  }, [state.index, targetX, bubbleX]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { paddingBottom: Math.max(insets?.bottom ?? 0, tabBarFloatOffset) },
      ]}
    >
      <View style={styles.pill}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={70}
            tint="systemChromeMaterialDark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.pillTint} pointerEvents="none" />
        <LinearGradient
          colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
          pointerEvents="none"
          style={styles.sheen}
        />

        <View
          style={styles.items}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && Math.abs(width - containerWidth) > 1) {
              setContainerWidth(width);
            }
          }}
        >
          {/* Active Tab Selection Bubble (Pill) */}
          <Animated.View
            pointerEvents="none"
            style={[styles.bubble, { width: bubbleWidth }, bubbleStyle]}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.05)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {state.routes.map((route, index) => {
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                badge={
                  route.name === "chat" ? (
                    <ChatTabBadge focused={focused} />
                  ) : undefined
                }
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
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(12,12,16,0.65)",
    overflow: "hidden",
    boxShadow: shadows.glass,
  },
  pillTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      Platform.OS === "ios" ? "rgba(10,10,14,0.34)" : "rgba(10,10,14,0.92)",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 20,
  },
  items: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: PADDING_H,
  },
  bubble: {
    position: "absolute",
    left: 0,
    top: LOZENGE_TOP,
    height: LOZENGE_HEIGHT,
    borderRadius: LOZENGE_HEIGHT / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.11)",
    overflow: "hidden",
    elevation: 4,
  },
  item: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    zIndex: 1,
  },
  iconSlot: {
    width: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 2,
  },
});
