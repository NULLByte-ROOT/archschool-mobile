import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, radius } from "@/theme/tokens";

export function ProgressBar({
  value,
  color = colors.amber,
  trackColor = "rgba(255,255,255,0.07)",
  height = 7,
  delay = 0,
}: {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  delay?: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const timer = setTimeout(() => {
      progress.value = withTiming(safe, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    }, Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [delay, progress, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%` as `${number}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2, backgroundColor: color },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { height: "100%", minWidth: 2 },
});
