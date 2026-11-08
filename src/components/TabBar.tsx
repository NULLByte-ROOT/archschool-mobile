import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
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
  shadows,
  tabBarFloatOffset,
  tabBarHeight,
  tabBarMargin,
} from "@/theme/tokens";

/**
 * Floating "liquid glass" tab bar (iOS 26 style).
 *
 * A taller floating pill with a heavier blur. The selection is a glass
 * lozenge that can be dragged left/right across the tabs; releasing snaps it
 * onto the nearest tab and navigates there.
 *
 * Geometry lives in `theme/tokens.ts` so every screen reserves the same amount
 * of space at the bottom.
 */

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "لیدر بورد", icon: "podium-outline", activeIcon: "podium" },
  profile: { label: "پروفایل", icon: "person-circle-outline", activeIcon: "person-circle" },
};

/** Horizontal padding inside the pill; the sliding lozenge lines up with it. */
const ITEMS_PADDING = 8;
/**
 * Side gap between the lozenge and an item. It must be generous enough that
 * the lozenge never touches the pill's rounded ends (that used to clip it into
 * a corner sliver on the outermost tabs).
 */
const LOZENGE_GAP = 16;
const LOZENGE_TOP = 9;
const SPRING = { damping: 20, stiffness: 210, mass: 0.9 } as const;

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

  const progress = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 190 });
  }, [focused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * (1 + progress.value * 0.08) },
      { translateY: -(progress.value * 2) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.62 + progress.value * 0.38,
    transform: [{ translateY: -(progress.value * 0.5) }],
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
        <Animated.View style={iconStyle}>
          <Ionicons
            name={focused ? meta.activeIcon : meta.icon}
            size={focused ? 27 : 25}
            color={focused ? colors.white : "rgba(255,255,255,0.62)"}
          />
        </Animated.View>
        {badge > 0 && !focused ? <Badge count={badge} style={styles.badge} /> : null}
      </View>

      <Animated.View style={labelStyle}>
        <AppText
          variant="caption"
          color={focused ? colors.white : "rgba(255,255,255,0.62)"}
          align="center"
          style={{
            fontFamily: focused ? fonts.semibold : fonts.medium,
            fontSize: 11,
            lineHeight: 16,
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

  const count = state.routes.length;
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth =
    count > 0 ? Math.max((barWidth - ITEMS_PADDING * 2) / count, 0) : 0;
  const lozengeWidth = Math.max(itemWidth - LOZENGE_GAP, 0);

  const lozengeX = useSharedValue(0);
  const committedX = useSharedValue(0);
  const dragLift = useSharedValue(0);
  const tickIndex = useSharedValue(-1);
  const touchIndex = useSharedValue(-1);
  const measured = useRef(false);
  const suppressPressUntil = useRef(0);

  useEffect(() => {
    if (itemWidth <= 0) return;
    // The bar reads right-to-left, so index 0 is the rightmost tab.
    const target =
      ITEMS_PADDING +
      (count - 1 - state.index) * itemWidth +
      LOZENGE_GAP / 2;
    committedX.value = target;
    if (!measured.current) {
      lozengeX.value = target;
      measured.current = true;
    } else {
      lozengeX.value = withSpring(target, SPRING);
    }
  }, [count, committedX, itemWidth, lozengeX, state.index]);

  const lozengeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lozengeX.value },
      { scale: 1 + dragLift.value * 0.04 },
    ],
  }));

  const tick = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const selectTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return;
    if (index === state.index) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined
    );
    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigateToTab(route.key);
    }
  };

  /**
   * Called only when the pan actually activated (a real horizontal drag).
   * It owns navigation from that point on, so the tap Pressable must not fire
   * a second time when the finger lifts.
   */
  const finishDrag = (index: number) => {
    suppressPressUntil.current = Date.now() + 180;
    dragLift.value = withTiming(0, { duration: 130 });
    if (index === state.index) {
      lozengeX.value = withSpring(committedX.value, SPRING);
      return;
    }
    selectTab(index);
  };

  /**
   * The pan failed (a normal tap, or a cancelled touch). A failed gesture fires
   * `onFinalize(false)` for *every* tap, so this must not touch
   * `suppressPressUntil` — that was swallowing taps and made the bar need
   * several presses before it navigated.
   */
  const snapBack = () => {
    dragLift.value = withTiming(0, { duration: 130 });
    lozengeX.value = withSpring(committedX.value, SPRING);
  };

  const drag = Gesture.Pan()
    // Only horizontal intent starts a drag; vertical wobble stays a tap.
    .activeOffsetX([-12, 12])
    .onStart((event) => {
      dragLift.value = withTiming(1, { duration: 120 });
      if (itemWidth > 0) {
        const slot = Math.floor((event.x - ITEMS_PADDING) / itemWidth);
        touchIndex.value =
          count - 1 - Math.min(count - 1, Math.max(0, slot));
      }
      runOnJS(tick)();
    })
    .onUpdate((event) => {
      if (itemWidth <= 0) return;
      const min = ITEMS_PADDING + LOZENGE_GAP / 2;
      const max = ITEMS_PADDING + (count - 1) * itemWidth + LOZENGE_GAP / 2;
      const next = Math.min(
        max,
        Math.max(min, committedX.value + event.translationX)
      );
      lozengeX.value = next;

      const slot = Math.round((next - min) / itemWidth);
      const index = count - 1 - Math.min(count - 1, Math.max(0, slot));
      if (index !== tickIndex.value) {
        tickIndex.value = index;
        runOnJS(tick)();
      }
    })
    .onEnd((event) => {
      if (itemWidth <= 0) return;
      // A tiny wobble is still a tap on the tab that was pressed.
      if (
        Math.abs(event.translationX) < 8 &&
        Math.abs(event.translationY) < 8
      ) {
        runOnJS(finishDrag)(touchIndex.value);
        return;
      }
      const min = ITEMS_PADDING + LOZENGE_GAP / 2;
      const slot = Math.round((lozengeX.value - min) / itemWidth);
      const index = count - 1 - Math.min(count - 1, Math.max(0, slot));
      runOnJS(finishDrag)(index);
    })
    .onFinalize((_event, success) => {
      if (!success) {
        runOnJS(snapBack)();
      }
    });

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
          intensity={80}
          tint="systemChromeMaterialDark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        {/* Fallback tint: keeps the glass readable if the platform can't blur. */}
        <View style={styles.pillTint} pointerEvents="none" />
        {/* Top inner highlight — the "liquid" sheen. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          pointerEvents="none"
          style={styles.sheen}
        />

        <GestureDetector gesture={drag}>
          <View
            style={styles.items}
            onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          >
            {/* Back layer: the tinted glass body sits behind the icons. */}
            {lozengeWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.lozenge, { width: lozengeWidth }, lozengeStyle]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.05)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}

            {state.routes.map((route, index) => {
              const focused = state.index === index;
              return (
                <TabItem
                  key={route.key}
                  routeName={route.name}
                  focused={focused}
                  badge={route.name === "chat" ? chatBadge : 0}
                  onPress={() => {
                    if (Date.now() < suppressPressUntil.current) return;
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

            {/* Front layer: specular rim above the icons, so the glass wraps
                them instead of sitting invisibly behind them. */}
            {lozengeWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.lozengeRim,
                  { width: lozengeWidth },
                  lozengeStyle,
                ]}
              >
                <View style={styles.lozengeEdge} />
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.16)",
                    "rgba(255,255,255,0.02)",
                    "rgba(255,255,255,0)",
                  ]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
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
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(12,12,16,0.52)",
    overflow: "hidden",
    boxShadow: shadows.glass,
  },
  pillTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,14,0.34)",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 24,
  },
  items: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: ITEMS_PADDING,
  },
  lozenge: {
    position: "absolute",
    top: LOZENGE_TOP,
    height: tabBarHeight - LOZENGE_TOP * 2,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    boxShadow: "0px 8px 20px -8px rgba(0,0,0,0.65)",
  },
  lozengeRim: {
    position: "absolute",
    top: LOZENGE_TOP,
    height: tabBarHeight - LOZENGE_TOP * 2,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  lozengeEdge: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  item: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconSlot: {
    width: 52,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { position: "absolute", top: 0, right: 4 },
});
