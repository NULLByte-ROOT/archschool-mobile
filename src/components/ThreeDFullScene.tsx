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
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { colors } from "@/theme/tokens";

const { width, height } = Dimensions.get("window");
const SCENE_SIZE = Math.min(width * 0.95, 360);

interface ThreeDFullSceneProps {
  type: 0 | 1 | 2; // 0: Cyan Monolith, 1: Solar Chronometer, 2: Emerald Crystal
}

export function ThreeDFullScene({ type }: ThreeDFullSceneProps) {
  const rotateX = useSharedValue(type === 0 ? 15 : type === 1 ? -10 : 20);
  const rotateY = useSharedValue(type === 0 ? -25 : type === 1 ? 30 : -35);
  const rotateZ = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotateZ.value = withRepeat(
      withTiming(360, { duration: 22000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.94, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [rotateZ, pulse]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      rotateY.value += e.velocityX * 0.0008;
      rotateX.value -= e.velocityY * 0.0008;
    })
    .onEnd((e) => {
      rotateY.value = withDecay({ velocity: e.velocityX * 0.0005, clamp: [-720, 720] });
      rotateX.value = withDecay({ velocity: -e.velocityY * 0.0005, clamp: [-80, 80] });
    });

  const coreAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1200 },
        { scale: pulse.value },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rotateY.value}deg` },
      ],
    };
  });

  const ring1Style = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 900 },
        { rotateZ: `${rotateZ.value}deg` },
        { rotateX: "70deg" },
      ],
    };
  });

  const ring2Style = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 900 },
        { rotateZ: `${-rotateZ.value * 1.4}deg` },
        { rotateY: "65deg" },
      ],
    };
  });

  const ring3Style = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 900 },
        { rotateZ: `${rotateZ.value * 0.8}deg` },
        { rotateX: "-45deg" },
        { rotateY: "35deg" },
      ],
    };
  });

  if (type === 0) {
    // -------------------------------------------------------------
    // SCENE 0: Neon Cyan / Platinum Cyber Core (Smart Homework)
    // -------------------------------------------------------------
    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.fullCanvas}>
          {/* Deep Ambient Glow */}
          <View style={[styles.ambientGlow, { backgroundColor: "#0284C7", opacity: 0.22 }]} />

          {/* Background Digital Grid */}
          <View style={styles.bgGridContainer}>
            <Svg width={width} height={height * 0.6} viewBox={`0 0 ${width} 400`}>
              <Defs>
                <LinearGradient id="gridFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.12" />
                  <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {[-120, -60, 0, 60, 120, 180, 240, 300, 360, 420].map((x, i) => (
                <Path
                  key={`v-${i}`}
                  d={`M ${width / 2 + x * 2.2} 400 L ${width / 2 + x * 0.3} 100`}
                  stroke="url(#gridFade)"
                  strokeWidth="1"
                />
              ))}
              {[140, 190, 250, 320, 390].map((y, i) => (
                <Path
                  key={`h-${i}`}
                  d={`M 0 ${y} L ${width} ${y}`}
                  stroke="url(#gridFade)"
                  strokeWidth="1"
                />
              ))}
            </Svg>
          </View>

          {/* Outer Orbital Rings */}
          <Animated.View style={[styles.ringLayer, ring1Style]}>
            <Svg width={SCENE_SIZE * 1.25} height={SCENE_SIZE * 1.25} viewBox="0 0 300 300">
              <Circle
                cx="150"
                cy="150"
                r="140"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeDasharray="25 15 5 15"
                fill="none"
              />
              <Circle cx="150" cy="10" r="5" fill="#38BDF8" />
              <Circle cx="290" cy="150" r="3.5" fill="#FFFFFF" />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.ringLayer, ring2Style]}>
            <Svg width={SCENE_SIZE * 1.1} height={SCENE_SIZE * 1.1} viewBox="0 0 300 300">
              <Circle
                cx="150"
                cy="150"
                r="135"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                strokeDasharray="40 25"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {/* 3D Cyan Polyhedral Core */}
          <Animated.View style={[styles.coreBox, coreAnimStyle]}>
            <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
              <Defs>
                <LinearGradient id="cyanTop" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.75" />
                  <Stop offset="100%" stopColor="#0284C7" stopOpacity="0.3" />
                </LinearGradient>
                <LinearGradient id="cyanLeft" x1="1" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#0369A1" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#0C4A6E" stopOpacity="0.95" />
                </LinearGradient>
                <LinearGradient id="cyanRight" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.6" />
                  <Stop offset="100%" stopColor="#075985" stopOpacity="0.9" />
                </LinearGradient>
              </Defs>

              {/* Isometric Top */}
              <Path
                d="M 150 50 L 245 105 L 150 160 L 55 105 Z"
                fill="url(#cyanTop)"
                stroke="#BAE6FD"
                strokeWidth="2"
              />
              {/* Isometric Left */}
              <Path
                d="M 55 105 L 150 160 L 150 265 L 55 210 Z"
                fill="url(#cyanLeft)"
                stroke="rgba(186,230,253,0.5)"
                strokeWidth="2"
              />
              {/* Isometric Right */}
              <Path
                d="M 150 160 L 245 105 L 245 210 L 150 265 Z"
                fill="url(#cyanRight)"
                stroke="rgba(186,230,253,0.5)"
                strokeWidth="2"
              />

              {/* Glowing Internal Fusion Spark */}
              <Circle cx="150" cy="160" r="26" fill="#38BDF8" opacity={0.85} />
              <Circle cx="150" cy="160" r="42" stroke="#38BDF8" strokeWidth="1.5" opacity={0.4} />

              {/* Tech Corner Nodes */}
              <Circle cx="150" cy="50" r="4.5" fill="#FFFFFF" />
              <Circle cx="245" cy="105" r="4.5" fill="#FFFFFF" />
              <Circle cx="55" cy="105" r="4.5" fill="#FFFFFF" />
              <Circle cx="150" cy="265" r="4.5" fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
    );
  }

  if (type === 1) {
    // -------------------------------------------------------------
    // SCENE 1: Solar Gold / Amber Orbital Chronometer (Bell Radar)
    // -------------------------------------------------------------
    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.fullCanvas}>
          {/* Solar Warm Glow */}
          <View style={[styles.ambientGlow, { backgroundColor: "#D97706", opacity: 0.28 }]} />

          {/* Orbital Radar Disk Rings */}
          <Animated.View style={[styles.ringLayer, ring1Style]}>
            <Svg width={SCENE_SIZE * 1.35} height={SCENE_SIZE * 1.35} viewBox="0 0 320 320">
              <Circle
                cx="160"
                cy="160"
                r="150"
                stroke="#FBBF24"
                strokeWidth="2.5"
                strokeDasharray="20 12 4 12"
                fill="none"
              />
              <Circle cx="160" cy="10" r="6" fill="#F59E0B" />
              <Circle cx="10" cy="160" r="4" fill="#FCD34D" />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.ringLayer, ring2Style]}>
            <Svg width={SCENE_SIZE * 1.2} height={SCENE_SIZE * 1.2} viewBox="0 0 300 300">
              <Circle
                cx="150"
                cy="150"
                r="140"
                stroke="#F97316"
                strokeWidth="1.8"
                strokeDasharray="50 30"
                fill="none"
              />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.ringLayer, ring3Style]}>
            <Svg width={SCENE_SIZE * 1.05} height={SCENE_SIZE * 1.05} viewBox="0 0 280 280">
              <Circle
                cx="140"
                cy="140"
                r="130"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1.5"
                strokeDasharray="15 15"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {/* 3D Solar Core Chronometer */}
          <Animated.View style={[styles.coreBox, coreAnimStyle]}>
            <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
              <Defs>
                <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#FEF08A" stopOpacity="0.9" />
                  <Stop offset="50%" stopColor="#F59E0B" stopOpacity="0.7" />
                  <Stop offset="100%" stopColor="#78350F" stopOpacity="0.95" />
                </LinearGradient>
                <LinearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#B45309" stopOpacity="0.6" />
                  <Stop offset="100%" stopColor="#451A03" stopOpacity="0.9" />
                </LinearGradient>
              </Defs>

              {/* Main Sphere Outer Dial */}
              <Circle cx="150" cy="150" r="95" fill="url(#dialGrad)" stroke="#FBBF24" strokeWidth="3" />

              {/* Chronometer Clock Markings */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = 150 + Math.cos(rad) * 78;
                const y1 = 150 + Math.sin(rad) * 78;
                const x2 = 150 + Math.cos(rad) * 88;
                const y2 = 150 + Math.sin(rad) * 88;
                return (
                  <Path
                    key={deg}
                    d={`M ${x1} ${y1} L ${x2} ${y2}`}
                    stroke={deg % 90 === 0 ? "#FDE047" : "#F59E0B"}
                    strokeWidth={deg % 90 === 0 ? "3" : "1.5"}
                  />
                );
              })}

              {/* Inner Pulsing Sun Core */}
              <Circle cx="150" cy="150" r="38" fill="url(#goldGrad)" />
              <Circle cx="150" cy="150" r="54" stroke="#FDE68A" strokeWidth="1.5" opacity={0.6} />

              {/* Dynamic Watch Hands */}
              <Path d="M 150 150 L 150 82" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
              <Path d="M 150 150 L 200 150" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
              <Circle cx="150" cy="150" r="6" fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
    );
  }

  // -------------------------------------------------------------
  // SCENE 2: Emerald Crystal League (Team Competition & Streaks)
  // -------------------------------------------------------------
  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.fullCanvas}>
        {/* Emerald Radiance Glow */}
        <View style={[styles.ambientGlow, { backgroundColor: "#059669", opacity: 0.26 }]} />

        {/* Emerald Laser Radial Beams */}
        <Animated.View style={[styles.ringLayer, ring1Style]}>
          <Svg width={SCENE_SIZE * 1.3} height={SCENE_SIZE * 1.3} viewBox="0 0 300 300">
            <Polygon
              points="150,15 285,150 150,285 15,150"
              stroke="#34D399"
              strokeWidth="2"
              fill="none"
              strokeDasharray="20 15"
            />
            <Circle cx="150" cy="15" r="5" fill="#6EE7B7" />
            <Circle cx="285" cy="150" r="5" fill="#6EE7B7" />
            <Circle cx="150" cy="285" r="5" fill="#6EE7B7" />
            <Circle cx="15" cy="150" r="5" fill="#6EE7B7" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.ringLayer, ring2Style]}>
          <Svg width={SCENE_SIZE * 1.15} height={SCENE_SIZE * 1.15} viewBox="0 0 300 300">
            <Circle
              cx="150"
              cy="150"
              r="138"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="30 20 5 20"
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* 3D Emerald Diamond / Trophy Crystal */}
        <Animated.View style={[styles.coreBox, coreAnimStyle]}>
          <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
            <Defs>
              <LinearGradient id="gemTopLeft" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#059669" stopOpacity="0.5" />
              </LinearGradient>
              <LinearGradient id="gemTopRight" x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#047857" stopOpacity="0.6" />
              </LinearGradient>
              <LinearGradient id="gemBotLeft" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0%" stopColor="#064E3B" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#059669" stopOpacity="0.7" />
              </LinearGradient>
              <LinearGradient id="gemBotRight" x1="1" y1="1" x2="0" y2="0">
                <Stop offset="0%" stopColor="#022C22" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#047857" stopOpacity="0.75" />
              </LinearGradient>
            </Defs>

            {/* Diamond Crown */}
            <Polygon
              points="150,45 220,105 150,135 80,105"
              fill="url(#gemTopLeft)"
              stroke="#D1FAE5"
              strokeWidth="1.8"
            />
            {/* Top Left Facet */}
            <Polygon
              points="80,105 150,135 150,225 80,165"
              fill="url(#gemBotLeft)"
              stroke="rgba(209,250,229,0.5)"
              strokeWidth="1.8"
            />
            {/* Top Right Facet */}
            <Polygon
              points="150,135 220,105 220,165 150,225"
              fill="url(#gemBotRight)"
              stroke="rgba(209,250,229,0.5)"
              strokeWidth="1.8"
            />
            {/* Bottom Pyramid Base */}
            <Polygon
              points="150,225 80,165 150,270"
              fill="url(#gemBotLeft)"
              stroke="rgba(209,250,229,0.4)"
              strokeWidth="1.5"
            />
            <Polygon
              points="150,225 220,165 150,270"
              fill="url(#gemBotRight)"
              stroke="rgba(209,250,229,0.4)"
              strokeWidth="1.5"
            />

            {/* Glowing Internal Victory Spark */}
            <Circle cx="150" cy="150" r="32" fill="#34D399" opacity={0.85} />
            <Circle cx="150" cy="150" r="48" stroke="#6EE7B7" strokeWidth="1.5" opacity={0.4} />

            {/* Trophy Vertex Points */}
            <Circle cx="150" cy="45" r="4.5" fill="#FFFFFF" />
            <Circle cx="220" cy="105" r="4" fill="#FFFFFF" />
            <Circle cx="80" cy="105" r="4" fill="#FFFFFF" />
            <Circle cx="150" cy="270" r="4.5" fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fullCanvas: {
    width,
    height: height * 0.52,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientGlow: {
    position: "absolute",
    width: SCENE_SIZE * 1.1,
    height: SCENE_SIZE * 1.1,
    borderRadius: (SCENE_SIZE * 1.1) / 2,
  },
  bgGridContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.6,
  },
  ringLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  coreBox: {
    width: SCENE_SIZE,
    height: SCENE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
