import { Tabs } from "expo-router/js-tabs";
import { usePathname, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useRef } from "react";
import { Easing, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { TabBar } from "@/components/TabBar";
import { colors } from "@/theme/tokens";

const TAB_ORDER = ["home", "assignments", "chat", "leaderboard", "profile"] as const;

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const lastSwitchTime = useRef(0);

  const foundIndex = TAB_ORDER.findIndex((tab) => pathname.includes(tab));
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;

  const switchTab = useCallback(
    (offset: number) => {
      const now = Date.now();
      if (now - lastSwitchTime.current < 280) return;
      const nextIndex = currentIndex + offset;
      if (nextIndex >= 0 && nextIndex < TAB_ORDER.length && nextIndex !== currentIndex) {
        lastSwitchTime.current = now;
        void Haptics.selectionAsync().catch(() => undefined);
        router.navigate(`/(tabs)/${TAB_ORDER[nextIndex]}`);
      }
    },
    [currentIndex, router]
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      "worklet";
      // Opposite direction of tabs:
      // Swipe Right -> Next tab
      // Swipe Left -> Previous tab
      if (e.translationX > 35 || e.velocityX > 300) {
        runOnJS(switchTab)(1);
      } else if (e.translationX < -35 || e.velocityX < -300) {
        runOnJS(switchTab)(-1);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
            animation: "shift",
            transitionSpec: {
              animation: "timing",
              config: {
                duration: 240,
                easing: Easing.out(Easing.cubic),
              },
            },
            sceneStyle: { backgroundColor: colors.ink },
          }}
        >
          <Tabs.Screen name="home" options={{ title: "خانه" }} />
          <Tabs.Screen name="assignments" options={{ title: "تکالیف" }} />
          <Tabs.Screen name="chat" options={{ title: "گفتگو" }} />
          <Tabs.Screen name="leaderboard" options={{ title: "لیدر بورد" }} />
          <Tabs.Screen name="profile" options={{ title: "پروفایل" }} />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
});
