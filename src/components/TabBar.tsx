import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { fetchUnread, qk } from "@/api/client";
import { AppText, Badge, type IconName } from "@/components/ui";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const TABS: Record<
  string,
  { label: string; icon: IconName; activeIcon: IconName }
> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "رتبه‌ها", icon: "podium-outline", activeIcon: "podium" },
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
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.06 : 1, { damping: 16, stiffness: 220 });
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={styles.item}
      hitSlop={4}
    >
      <Animated.View style={[styles.itemInner, focused && styles.itemActive, animatedStyle]}>
        <View>
          <Ionicons
            name={focused ? meta.activeIcon : meta.icon}
            size={20}
            color={focused ? colors.amber : colors.faint}
          />
          {badge > 0 && !focused ? (
            <Badge count={badge} style={styles.badge} />
          ) : null}
        </View>
        <AppText
          variant="caption"
          color={focused ? colors.amber : colors.faint}
          style={{
            fontFamily: focused ? fonts.semibold : fonts.regular,
            fontSize: 10.5,
            lineHeight: 15,
          }}
        >
          {meta.label}
        </AppText>
      </Animated.View>
      <View style={[styles.dot, { opacity: focused ? 1 : 0 }]} />
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
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.pill}>
        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.pillTint} pointerEvents="none" />
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
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.sm,
    paddingTop: 6,
    backgroundColor: colors.ink,
  },
  pill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: "rgba(9,16,27,0.72)",
    overflow: "hidden",
    height: 62,
    paddingHorizontal: 4,
    boxShadow: "0px -16px 38px -22px rgba(0,0,0,0.95)",
  },
  pillTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(7,12,20,0.35)",
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  itemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    minWidth: 54,
  },
  itemActive: { backgroundColor: colors.amberSoft },
  badge: { position: "absolute", top: -6, right: -10 },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
});
