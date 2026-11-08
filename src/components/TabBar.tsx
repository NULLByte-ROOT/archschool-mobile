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
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
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
 * The selection is a glass bubble that sits *on top* of the bar. It is placed
 * from the **measured** rect of the selected tab (never from an assumed index
 * order), so it lines up on both LTR and RTL devices and can never drift
 * outside the pill.
 *
 * Dragging the bubble stretches it like jelly, and releasing snaps it to the
 * nearest tab and lets it wobble for ~2s.
 */

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "لیدر بورد", icon: "podium-outline", activeIcon: "podium" },
  profile: { label: "پروفایل", icon: "person-circle-outline", activeIcon: "person-circle" },
};

/** Gap between the bubble and the tab it covers (keeps clear of the pill rim). */
const LOZENGE_GAP = 14;
const LOZENGE_TOP = 10;
const LOZENGE_HEIGHT = tabBarHeight - LOZENGE_TOP * 2;

/** Bouncy spring — the bubble overshoots a little instead of gliding flat. */
const SPRING = { damping: 13, stiffness: 190, mass: 0.9 } as const;

type Rect = { x: number; width: number };

function TabItem({
  routeName,
  focused,
  badge,
  onPress,
  onLayout,
}: {
  routeName: string;
  focused: boolean;
  badge: number;
  onPress: () => void;
  onLayout: (rect: Rect) => void;
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
      onLayout={(event) => {
        const { x, width } = event.nativeEvent.layout;
        onLayout({ x, width });
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

  // Real measured geometry, one entry per tab. `x` is relative to the bar.
  const [rects, setRects] = useState<(Rect | undefined)[]>([]);

  const itemWidth = rects.find((rect) => rect)?.width ?? 0;
  const bubbleWidth = Math.max(itemWidth - LOZENGE_GAP, 0);

  // Every tab's bubble position (left edge), in the bar's coordinate space.
  const targets = rects.map((rect) =>
    rect ? rect.x + LOZENGE_GAP / 2 : Number.NaN
  );
  const centers = rects.map((rect) =>
    rect ? rect.x + rect.width / 2 : Number.NaN
  );
  const ready = rects.filter(Boolean).length === count && bubbleWidth > 0;
  const targetX = targets[state.index];
  const minTarget = ready ? Math.min(...(targets as number[])) : 0;
  const maxTarget = ready ? Math.max(...(targets as number[])) : 0;

  const lozengeX = useSharedValue(0);
  const committedX = useSharedValue(0);
  const dragLift = useSharedValue(0);
  const stretch = useSharedValue(0);
  const jelly = useSharedValue(0);
  const tickIndex = useSharedValue(-1);
  const touchIndex = useSharedValue(0);
  const measured = useRef(false);
  const suppressPressUntil = useRef(0);

  const setRect = (index: number, rect: Rect) => {
    setRects((prev) => {
      const old = prev[index];
      if (old && Math.abs(old.x - rect.x) < 0.5 && Math.abs(old.width - rect.width) < 0.5) {
        return prev;
      }
      const next = prev.slice();
      next[index] = rect;
      return next;
    });
  };

  /** A loose, decaying wobble — the "let go and it jiggles" feel. */
  const startJelly = (strength: number) => {
    const s = Math.max(0.25, Math.min(1, strength));
    cancelAnimation(jelly);
    jelly.value = 0;
    jelly.value = withSequence(
      withTiming(1 * s, { duration: 110 }),
      withTiming(-0.82 * s, { duration: 170 }),
      withTiming(0.64 * s, { duration: 190 }),
      withTiming(-0.48 * s, { duration: 230 }),
      withTiming(0.34 * s, { duration: 270 }),
      withTiming(-0.22 * s, { duration: 310 }),
      withTiming(0.12 * s, { duration: 350 }),
      withTiming(-0.06 * s, { duration: 380 }),
      withTiming(0, { duration: 430 })
    );
  };

  useEffect(() => {
    if (!ready || !Number.isFinite(targetX)) return;
    committedX.value = targetX;
    if (!measured.current) {
      lozengeX.value = targetX;
      measured.current = true;
      return;
    }
    lozengeX.value = withSpring(targetX, SPRING);
    startJelly(0.7);
    // `startJelly` only touches shared values, so it is safe to omit here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, targetX, lozengeX, committedX]);

  const lozengeStyle = useAnimatedStyle(() => {
    const lift = dragLift.value;
    const wobble = jelly.value;
    return {
      transform: [
        { translateX: lozengeX.value + wobble * 2 },
        { scaleX: 1 + stretch.value + wobble * 0.055 + lift * 0.02 },
        { scaleY: 1 - stretch.value * 0.55 - wobble * 0.04 },
      ],
    };
  });

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
   * Only called when the pan actually activated (a real horizontal drag), so
   * it owns navigation from that point and the tap Pressable must not fire a
   * second time when the finger lifts.
   */
  const finishDrag = (index: number, velocityX: number) => {
    suppressPressUntil.current = Date.now() + 180;
    dragLift.value = withTiming(0, { duration: 160 });
    stretch.value = withTiming(0, { duration: 220 });
    const x = targets[index];
    if (!Number.isFinite(x)) return;
    if (index === state.index) {
      committedX.value = x;
      lozengeX.value = withSpring(x, SPRING);
    } else {
      selectTab(index);
    }
    startJelly(0.55 + Math.min(0.45, Math.abs(velocityX) / 3000));
  };

  /**
   * A failed pan fires `onFinalize(false)` for every normal tap, so this must
   * never suppress the tap — that used to make the bar need several presses.
   */
  const snapBack = () => {
    dragLift.value = withTiming(0, { duration: 160 });
    stretch.value = withTiming(0, { duration: 220 });
    lozengeX.value = withSpring(committedX.value, SPRING);
  };

  /** Nearest tab to a bubble center — works for both layout directions. */
  const indexAt = (centerX: number) => {
    "worklet";
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < centers.length; i += 1) {
      const distance = Math.abs(centers[i] - centerX);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  };

  const drag = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart((event) => {
      cancelAnimation(jelly);
      jelly.value = 0;
      dragLift.value = withTiming(1, { duration: 120 });
      stretch.value = withTiming(0.03, { duration: 140 });
      if (ready) {
        touchIndex.value = indexAt(event.x);
      }
      runOnJS(tick)();
    })
    .onUpdate((event) => {
      if (!ready) return;
      const next = Math.min(
        maxTarget,
        Math.max(minTarget, committedX.value + event.translationX)
      );
      lozengeX.value = next;

      // Stretch more the faster the finger moves, so the bubble trails.
      const amount = Math.min(0.16, Math.abs(event.velocityX) / 22000);
      stretch.value = withTiming(0.03 + amount, { duration: 90 });

      const index = indexAt(next + bubbleWidth / 2);
      if (index !== tickIndex.value) {
        tickIndex.value = index;
        runOnJS(tick)();
      }
    })
    .onEnd((event) => {
      if (!ready) return;
      const index = indexAt(lozengeX.value + bubbleWidth / 2);
      runOnJS(finishDrag)(index, event.velocityX);
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
          <View style={styles.bar}>
            {/* Back layer: the glass body of the bubble, behind the icons. */}
            {ready ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.lozenge, { width: bubbleWidth }, lozengeStyle]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0.06)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}

            <View style={styles.items}>
              {state.routes.map((route, index) => {
                const focused = state.index === index;
                return (
                  <TabItem
                    key={route.key}
                    routeName={route.name}
                    focused={focused}
                    badge={route.name === "chat" ? chatBadge : 0}
                    onLayout={(rect) => setRect(index, rect)}
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
            </View>

            {/* Front layer: specular rim above the icons, so the glass wraps
                them instead of sitting invisibly behind them. */}
            {ready ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.lozengeRim, { width: bubbleWidth }, lozengeStyle]}
              >
                <View style={styles.lozengeEdge} />
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0.18)",
                    "rgba(255,255,255,0.03)",
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
  /** Full-bleed bar: the bubble is positioned in *this* coordinate space. */
  bar: {
    flex: 1,
  },
  items: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  /* The bubble: explicit `left: 0` so it can never inherit a static position
     from the row (that was pushing it outside the pill on the edge tabs). */
  lozenge: {
    position: "absolute",
    left: 0,
    top: LOZENGE_TOP,
    height: LOZENGE_HEIGHT,
    borderRadius: LOZENGE_HEIGHT / 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    boxShadow: "0px 10px 24px -8px rgba(0,0,0,0.70)",
  },
  lozengeRim: {
    position: "absolute",
    left: 0,
    top: LOZENGE_TOP,
    height: LOZENGE_HEIGHT,
    borderRadius: LOZENGE_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  lozengeEdge: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.34)",
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
