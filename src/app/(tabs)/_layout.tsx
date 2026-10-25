import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "@/components/TabBar";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "خانه" }} />
      <Tabs.Screen name="assignments" options={{ title: "تکالیف" }} />
      <Tabs.Screen name="chat" options={{ title: "گفتگو" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "لیدر بورد" }} />
      <Tabs.Screen name="profile" options={{ title: "پروفایل" }} />
    </Tabs>
  );
}
