import { Tabs } from "expo-router/js-tabs";
import { usePathname, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { TabBar } from "@/components/TabBar";
import { colors } from "@/theme/tokens";

const TAB_ORDER = ["home", "assignments", "chat", "leaderboard", "profile"] as const;

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const foundIndex = TAB_ORDER.findIndex((tab) => pathname.includes(tab));
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;

  const switchTab = useCallback(
    (offset: number) => {
      const nextIndex = currentIndex + offset;
      if (nextIndex >= 0 && nextIndex < TAB_ORDER.length && nextIndex !== currentIndex) {
        void Haptics.selectionAsync().catch(() => undefined);
        router.navigate(`/(tabs)/${TAB_ORDER[nextIndex]}`);
      }
    },
    [currentIndex, router]
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-26, 26])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      "worklet";
      if (e.translationX < -45 || e.velocityX < -420) {
        runOnJS(switchTab)(1);
      } else if (e.translationX > 45 || e.velocityX > 420) {
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
