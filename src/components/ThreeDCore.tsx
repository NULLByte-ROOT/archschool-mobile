import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "@/theme/tokens";

const { width } = Dimensions.get("window");
const CORE_SIZE = Math.min(width * 0.72, 280);

interface ThreeDCoreProps {
  stage?: number; // 0: Blue/Platinum, 1: Amber Solar, 2: Emerald Trophy
  interactive?: boolean;
}

export function ThreeDCore({ stage = 0, interactive = true }: ThreeDCoreProps) {
  const rotateX = useSharedValue(15);
  const rotateY = useSharedValue(-25);
  const rotateZ = useSharedValue(0);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  // Auto idle rotation
  useEffect(() => {
    rotateZ.value = withRepeat(
      withTiming(360, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.96, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [rotateZ, pulse]);

  // Stage changes adjust scale and base rotation
  useEffect(() => {
    scale.value = withSpring(1.05, { damping: 12 }, () => {
      scale.value = withSpring(1);
    });
  }, [stage, scale]);

  const panGesture = Gesture.Pan()
    .enabled(interactive)
    .onUpdate((e) => {
      rotateY.value += e.velocityX * 0.0006;
      rotateX.value -= e.velocityY * 0.0006;
    })
    .onEnd((e) => {
      rotateY.value = withDecay({ velocity: e.velocityX * 0.0004, clamp: [-720, 720] });
      rotateX.value = withDecay({ velocity: -e.velocityY * 0.0004, clamp: [-75, 75] });
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { scale: scale.value * pulse.value },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 800 },
        { rotateZ: `${rotateZ.value}deg` },
        { rotateX: "65deg" },
      ],
    };
  });

  const counterRingStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 800 },
        { rotateZ: `${-rotateZ.value * 1.5}deg` },
        { rotateY: "60deg" },
      ],
    };
  });

  // Stage colors
  const primaryGlow =
    stage === 1 ? colors.warning : stage === 2 ? colors.emerald : "#60A5FA";
  const secondaryGlow =
    stage === 1 ? colors.flame : stage === 2 ? colors.success : "#C084FC";

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Ambient Glow */}
        <View
          style={[
            styles.glowAura,
            { backgroundColor: primaryGlow, opacity: 0.18 },
          ]}
        />

        {/* Outer Orbital Gyroscope Ring */}
        <Animated.View style={[styles.ringContainer, ringStyle]}>
          <Svg width={CORE_SIZE * 1.3} height={CORE_SIZE * 1.3} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={primaryGlow} stopOpacity="0.8" />
                <Stop offset="50%" stopColor={secondaryGlow} stopOpacity="0.3" />
                <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Circle
              cx="100"
              cy="100"
              r="94"
              stroke="url(#ringGrad)"
              strokeWidth="2.5"
              strokeDasharray="14 10 2 10"
              fill="none"
            />
            <Circle cx="100" cy="6" r="3.5" fill={primaryGlow} />
          </Svg>
        </Animated.View>

        {/* Counter Ring */}
        <Animated.View style={[styles.ringContainer, counterRingStyle]}>
          <Svg width={CORE_SIZE * 1.15} height={CORE_SIZE * 1.15} viewBox="0 0 200 200">
            <Circle
              cx="100"
              cy="100"
              r="90"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              strokeDasharray="30 20"
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* 3D Polyhedral Monolith Core */}
        <Animated.View style={[styles.coreBox, animatedStyle]}>
          {/* Front / Top Facets of 3D Prism */}
          <Svg width={CORE_SIZE} height={CORE_SIZE} viewBox="0 0 240 240">
            <Defs>
              <LinearGradient id="face1" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <Stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
              </LinearGradient>
              <LinearGradient id="face2" x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={primaryGlow} stopOpacity="0.5" />
                <Stop offset="100%" stopColor="rgba(10,10,18,0.7)" />
              </LinearGradient>
              <LinearGradient id="face3" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0%" stopColor={secondaryGlow} stopOpacity="0.35" />
                <Stop offset="100%" stopColor="rgba(10,10,18,0.85)" />
              </LinearGradient>
            </Defs>

            {/* Isocube Isometric Top Face */}
            <Path
              d="M 120 40 L 190 80 L 120 120 L 50 80 Z"
              fill="url(#face1)"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
            />

            {/* Left Face */}
            <Path
              d="M 50 80 L 120 120 L 120 200 L 50 160 Z"
              fill="url(#face2)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />

            {/* Right Face */}
            <Path
              d="M 120 120 L 190 80 L 190 160 L 120 200 Z"
              fill="url(#face3)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
            />

            {/* Glowing Internal Crystal Core */}
            <Circle cx="120" cy="120" r="18" fill={primaryGlow} opacity={0.8} />
            <Circle cx="120" cy="120" r="30" stroke={primaryGlow} strokeWidth="1" opacity={0.4} />

            {/* Tech Vertex Accent Points */}
            <Circle cx="120" cy="40" r="3" fill="#FFFFFF" />
            <Circle cx="190" cy="80" r="3" fill="#FFFFFF" />
            <Circle cx="50" cy="80" r="3" fill="#FFFFFF" />
            <Circle cx="120" cy="200" r="3" fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CORE_SIZE * 1.35,
    height: CORE_SIZE * 1.35,
    alignItems: "center",
    justifyContent: "center",
  },
  glowAura: {
    position: "absolute",
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
  },
  ringContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  coreBox: {
    width: CORE_SIZE,
    height: CORE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
