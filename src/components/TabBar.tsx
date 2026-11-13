import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
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
 * Floating "liquid glass" tab bar.
 *
 * The selection is a glass bubble that sits smoothly behind the icons and
 * text of the active tab. It is positioned based on the measured rect of each
 * tab so it aligns symmetrically in both LTR and RTL directions.
 */

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: "خانه", icon: "grid-outline", activeIcon: "grid" },
  assignments: { label: "تکالیف", icon: "checkbox-outline", activeIcon: "checkbox" },
  chat: { label: "گفتگو", icon: "chatbubbles-outline", activeIcon: "chatbubbles" },
  leaderboard: { label: "لیدر بورد", icon: "podium-outline", activeIcon: "podium" },
  profile: { label: "پروفایل", icon: "person-circle-outline", activeIcon: "person-circle" },
};

const BUBBLE_INSET = 6;
const LOZENGE_TOP = 10;
const LOZENGE_HEIGHT = tabBarHeight - LOZENGE_TOP * 2;

/** Fluid spring for organic, smooth bubble movement without jitter. */
const SPRING = { damping: 17, stiffness: 210, mass: 0.8 } as const;

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
  badge?: ReactNode;
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
        {badge}
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

/**
 * The unread query lives in its own leaf so a 45s poll re-renders one small
 * badge instead of the whole tab bar (gesture detector + five animated tabs).
 * That keeps the first paint and every later poll cheap.
 */
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

  // Real measured geometry, one entry per tab. `x` is relative to the bar.
  const [rects, setRects] = useState<(Rect | undefined)[]>([]);
  // Collect all five layouts before asking React to render once; the old code
  // updated state on every onLayout (five renders before the first frame).
  const rectsRef = useRef<(Rect | undefined)[]>([]);

  const measured = rects.filter((rect): rect is Rect => Boolean(rect));
  const itemWidth = measured[0]?.width ?? 0;
  const barWidth = measured.length
    ? Math.max(...measured.map((rect) => rect.x + rect.width)) +
      Math.min(...measured.map((rect) => rect.x))
    : 0;
  // Sized to comfortably fit the tab content with balanced margins on all sides
  const bubbleWidth = itemWidth > 0 ? Math.max(itemWidth - 6, 56) : 60;

  const clampLeft = (left: number) => {
    if (barWidth <= 0) return left;
    const maxLeft = Math.max(
      barWidth - bubbleWidth - BUBBLE_INSET,
      BUBBLE_INSET
    );
    return Math.min(maxLeft, Math.max(BUBBLE_INSET, left));
  };

  // Every tab's bubble position (left edge), exactly centered on the tab
  const targets = rects.map((rect) =>
    rect
      ? clampLeft(rect.x + (rect.width - bubbleWidth) / 2)
      : Number.NaN
  );
  const centers = rects.map((rect) =>
    rect ? rect.x + rect.width / 2 : Number.NaN
  );
  const ready =
    rects.filter(Boolean).length === count && bubbleWidth > 0 && barWidth > 0;
  const targetX = targets[state.index];
  const minTarget = ready ? Math.min(...(targets as number[])) : 0;
  const maxTarget = ready ? Math.max(...(targets as number[])) : 0;

  const lozengeX = useSharedValue(0);
  const committedX = useSharedValue(0);
  const bubbleStartX = useSharedValue(0);
  const dragLift = useSharedValue(0);
  const stretch = useSharedValue(0);
  const bubbleOpacity = useSharedValue(0);
  const tickIndex = useSharedValue(-1);
  const measuredOnce = useRef(false);
  const suppressPressUntil = useRef(0);

  const setRect = (index: number, rect: Rect) => {
    const prev = rectsRef.current;
    const old = prev[index];
    if (
      old &&
      Math.abs(old.x - rect.x) < 0.5 &&
      Math.abs(old.width - rect.width) < 0.5
    ) {
      return;
    }
    const next = prev.slice();
    next[index] = rect;
    rectsRef.current = next;
    if (next.filter(Boolean).length === count) {
      setRects(next);
    }
  };

  useEffect(() => {
    if (!ready || !Number.isFinite(targetX)) return;
    committedX.value = targetX;
    if (!measuredOnce.current) {
      lozengeX.value = targetX;
      bubbleOpacity.value = withTiming(1, { duration: 180 });
      measuredOnce.current = true;
      return;
    }
    lozengeX.value = withSpring(targetX, SPRING);
  }, [ready, targetX, lozengeX, committedX, bubbleOpacity]);

  const lozengeStyle = useAnimatedStyle(() => {
    const lift = dragLift.value;
    return {
      opacity: bubbleOpacity.value,
      transform: [
        { translateX: lozengeX.value },
        { scaleX: 1 + stretch.value + lift * 0.03 },
        { scaleY: 1 - stretch.value * 0.35 - lift * 0.02 },
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
  const finishDrag = (index: number, _velocityX: number) => {
    suppressPressUntil.current = Date.now() + 180;
    dragLift.value = withTiming(0, { duration: 160 });
    stretch.value = withTiming(0, { duration: 200 });
    const x = targets[index];
    if (!Number.isFinite(x)) return;
    if (index === state.index) {
      committedX.value = x;
      lozengeX.value = withSpring(x, SPRING);
    } else {
      selectTab(index);
    }
  };

  /**
   * A failed pan fires `onFinalize(false)` for every normal tap, so this must
   * never suppress the tap — that used to make the bar need several presses.
   */
  const snapBack = () => {
    dragLift.value = withTiming(0, { duration: 160 });
    stretch.value = withTiming(0, { duration: 200 });
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
    .onStart(() => {
      bubbleStartX.value = lozengeX.value;
      dragLift.value = withTiming(1, { duration: 120 });
      stretch.value = withTiming(0.04, { duration: 140 });
      runOnJS(tick)();
    })
    .onUpdate((event) => {
      if (!ready) return;
      const next = Math.min(
        maxTarget,
        Math.max(minTarget, bubbleStartX.value + event.translationX)
      );
      lozengeX.value = next;

      // Stretch slightly when dragging fast
      const amount = Math.min(0.08, Math.abs(event.velocityX) / 22000);
      stretch.value = withTiming(0.04 + amount, { duration: 80 });

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
        {/* Android blur is the single most expensive part of the first frame.
            iOS gets the real blur; Android keeps the same dark glass with a
            static tint, which looks nearly identical and never stalls input. */}
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={70}
            tint="systemChromeMaterialDark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.pillTint} pointerEvents="none" />
        {/* Top inner highlight — the "liquid" sheen. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
          pointerEvents="none"
          style={styles.sheen}
        />

        <GestureDetector gesture={drag}>
          <View style={styles.bar}>
            {/* The liquid glass bubble: positioned cleanly behind the icons & labels */}
            {ready ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.lozenge, { width: bubbleWidth }, lozengeStyle]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.06)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.lozengeEdge} />
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
                    badge={
                      route.name === "chat" ? (
                        <ChatTabBadge focused={focused} />
                      ) : undefined
                    }
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
    // Without the iOS blur layer the tint has to carry the contrast itself.
    backgroundColor:
      Platform.OS === "ios" ? "rgba(10,10,14,0.34)" : "rgba(10,10,14,0.88)",
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
  /* The bubble: explicit `left: 0` so it positions accurately in the bar. */
  lozenge: {
    position: "absolute",
    left: 0,
    top: LOZENGE_TOP,
    height: LOZENGE_HEIGHT,
    borderRadius: LOZENGE_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    boxShadow: "0px 8px 22px -6px rgba(0,0,0,0.65)",
  },
  lozengeEdge: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.36)",
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
