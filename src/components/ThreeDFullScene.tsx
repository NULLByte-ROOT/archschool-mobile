import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

const { width, height } = Dimensions.get("window");
const SCENE_SIZE = Math.min(width * 0.88, 340);

interface ThreeDFullSceneProps {
  type: 0 | 1 | 2; // 0: Cyan Monolith, 1: Solar Chronometer, 2: Emerald Crystal
}

export function ThreeDFullScene({ type }: ThreeDFullSceneProps) {
  // 3D rotation angles
  const rotateX = useSharedValue(type === 0 ? 18 : type === 1 ? -12 : 22);
  const rotateY = useSharedValue(type === 0 ? -28 : type === 1 ? 32 : -36);
  const rotateZ = useSharedValue(0);
  const pulse = useSharedValue(1);
  const floatY = useSharedValue(0);

  useEffect(() => {
    // Continuous slow hypnotic rotation
    rotateZ.value = withRepeat(
      withTiming(360, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );

    // Subtle scale breathing
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Vertical floating hover
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(12, { duration: 2600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [rotateZ, pulse, floatY]);

  // Pan gesture: interactive 3D rotation with natural physical decay
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      rotateY.value += e.velocityX * 0.0009;
      rotateX.value -= e.velocityY * 0.0009;
    })
    .onEnd((e) => {
      rotateY.value = withDecay({
        velocity: e.velocityX * 0.0006,
        clamp: [-720, 720],
      });
      rotateX.value = withDecay({
        velocity: -e.velocityY * 0.0006,
        clamp: [-75, 75],
      });
    });

  const coreAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { translateY: floatY.value },
      { scale: pulse.value },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { translateY: floatY.value * 0.5 },
      { rotateZ: `${rotateZ.value}deg` },
      { rotateX: "68deg" },
    ],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { translateY: floatY.value * -0.4 },
      { rotateZ: `${-rotateZ.value * 1.3}deg` },
      { rotateY: "62deg" },
    ],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateZ: `${rotateZ.value * 0.75}deg` },
      { rotateX: "-48deg" },
      { rotateY: "38deg" },
    ],
  }));

  if (type === 0) {
    // =========================================================================
    // SCENE 0: Neon Cyan / Platinum Cyber Core (Full Screen Perspective)
    // =========================================================================
    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.fullScreenCanvas}>
          {/* Ambient Deep Glow in Center */}
          <View
            style={[
              styles.ambientGlow,
              { backgroundColor: "#0284C7", opacity: 0.28 },
            ]}
          />

          {/* Full-Screen Cyber Perspective Grid */}
          <View style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <Defs>
                <LinearGradient id="gridFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.02" />
                  <Stop offset="40%" stopColor="#38BDF8" stopOpacity="0.18" />
                  <Stop offset="80%" stopColor="#38BDF8" stopOpacity="0.04" />
                  <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {/* Perspective Rays radiating towards vanishing point */}
              {[-200, -140, -80, -20, 40, 100, 160, 220, 280, 340, 400, 460].map(
                (x, i) => (
                  <Path
                    key={`v-${i}`}
                    d={`M ${width / 2 + x * 2.2} ${height} L ${width / 2 + x * 0.15} ${height * 0.38}`}
                    stroke="url(#gridFade)"
                    strokeWidth="1.2"
                  />
                )
              )}
              {/* Horizontal depth tiers */}
              {[0.4, 0.45, 0.52, 0.6, 0.7, 0.82, 0.95].map((fraction, i) => (
                <Path
                  key={`h-${i}`}
                  d={`M 0 ${height * fraction} L ${width} ${height * fraction}`}
                  stroke="url(#gridFade)"
                  strokeWidth="1.2"
                />
              ))}
            </Svg>
          </View>

          {/* Central 3D Interactive Stage (Placed slightly above center) */}
          <View style={[styles.centerStage, { top: height * 0.32 }]}>
            {/* Outer Orbital Rings with glowing nodes */}
            <Animated.View style={[styles.ringLayer, ring1Style]}>
              <Svg
                width={SCENE_SIZE * 1.3}
                height={SCENE_SIZE * 1.3}
                viewBox="0 0 320 320"
              >
                <Circle
                  cx="160"
                  cy="160"
                  r="150"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                  strokeDasharray="26 14 6 14"
                  fill="none"
                />
                <Circle cx="160" cy="10" r="5" fill="#38BDF8" />
                <Circle cx="310" cy="160" r="4" fill="#FFFFFF" />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.ringLayer, ring2Style]}>
              <Svg
                width={SCENE_SIZE * 1.15}
                height={SCENE_SIZE * 1.15}
                viewBox="0 0 300 300"
              >
                <Circle
                  cx="150"
                  cy="150"
                  r="140"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.8"
                  strokeDasharray="45 25"
                  fill="none"
                />
                <Circle cx="10" cy="150" r="4" fill="#7DD3FC" />
              </Svg>
            </Animated.View>

            {/* 3D Cyan Polyhedral Quantum Monolith */}
            <Animated.View style={[styles.coreBox, coreAnimStyle]}>
              <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
                <Defs>
                  <LinearGradient id="cyanTop" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.85" />
                    <Stop offset="100%" stopColor="#0284C7" stopOpacity="0.35" />
                  </LinearGradient>
                  <LinearGradient id="cyanLeft" x1="1" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#0369A1" stopOpacity="0.85" />
                    <Stop offset="100%" stopColor="#082F49" stopOpacity="0.95" />
                  </LinearGradient>
                  <LinearGradient id="cyanRight" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.7" />
                    <Stop offset="100%" stopColor="#0369A1" stopOpacity="0.92" />
                  </LinearGradient>
                </Defs>

                {/* Isometric Top Diamond */}
                <Path
                  d="M 150 45 L 248 102 L 150 160 L 52 102 Z"
                  fill="url(#cyanTop)"
                  stroke="#E0F2FE"
                  strokeWidth="2.2"
                />
                {/* Isometric Left Facet */}
                <Path
                  d="M 52 102 L 150 160 L 150 268 L 52 210 Z"
                  fill="url(#cyanLeft)"
                  stroke="rgba(186,230,253,0.55)"
                  strokeWidth="2"
                />
                {/* Isometric Right Facet */}
                <Path
                  d="M 150 160 L 248 102 L 248 210 L 150 268 Z"
                  fill="url(#cyanRight)"
                  stroke="rgba(186,230,253,0.55)"
                  strokeWidth="2"
                />

                {/* Internal Luminous Fusion Spark */}
                <Circle cx="150" cy="160" r="28" fill="#38BDF8" opacity={0.9} />
                <Circle
                  cx="150"
                  cy="160"
                  r="45"
                  stroke="#38BDF8"
                  strokeWidth="1.8"
                  opacity={0.4}
                />

                {/* Corner Vertex Crystals */}
                <Circle cx="150" cy="45" r="5" fill="#FFFFFF" />
                <Circle cx="248" cy="102" r="5" fill="#FFFFFF" />
                <Circle cx="52" cy="102" r="5" fill="#FFFFFF" />
                <Circle cx="150" cy="268" r="5" fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
    );
  }

  if (type === 1) {
    // =========================================================================
    // SCENE 1: Solar Gold / Amber Astrolabe Chronometer (Full Screen)
    // =========================================================================
    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.fullScreenCanvas}>
          {/* Radiant Solar Background Glow */}
          <View
            style={[
              styles.ambientGlow,
              { backgroundColor: "#D97706", opacity: 0.32 },
            ]}
          />

          {/* Full-Screen Compass Degree Rays & Radial Field */}
          <View style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              <Defs>
                <LinearGradient id="solarFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FBBF24" stopOpacity="0.02" />
                  <Stop offset="35%" stopColor="#F59E0B" stopOpacity="0.22" />
                  <Stop offset="70%" stopColor="#D97706" stopOpacity="0.08" />
                  <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {/* Concentric ambient ripples radiating outward */}
              {[120, 180, 260, 360, 480].map((r, i) => (
                <Circle
                  key={`r-${i}`}
                  cx={width / 2}
                  cy={height * 0.32}
                  r={r}
                  stroke="url(#solarFade)"
                  strokeWidth="1.2"
                  strokeDasharray="18 12"
                  fill="none"
                />
              ))}
            </Svg>
          </View>

          {/* Central 3D Solar Stage */}
          <View style={[styles.centerStage, { top: height * 0.32 }]}>
            {/* Outer Astrolabe Disk */}
            <Animated.View style={[styles.ringLayer, ring1Style]}>
              <Svg
                width={SCENE_SIZE * 1.35}
                height={SCENE_SIZE * 1.35}
                viewBox="0 0 320 320"
              >
                <Circle
                  cx="160"
                  cy="160"
                  r="150"
                  stroke="#FBBF24"
                  strokeWidth="2.6"
                  strokeDasharray="24 14 5 14"
                  fill="none"
                />
                <Circle cx="160" cy="10" r="6" fill="#F59E0B" />
                <Circle cx="10" cy="160" r="4.5" fill="#FDE047" />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.ringLayer, ring2Style]}>
              <Svg
                width={SCENE_SIZE * 1.2}
                height={SCENE_SIZE * 1.2}
                viewBox="0 0 300 300"
              >
                <Circle
                  cx="150"
                  cy="150"
                  r="140"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeDasharray="55 35"
                  fill="none"
                />
                <Circle cx="290" cy="150" r="4" fill="#FDE68A" />
              </Svg>
            </Animated.View>

            <Animated.View style={[styles.ringLayer, ring3Style]}>
              <Svg
                width={SCENE_SIZE * 1.05}
                height={SCENE_SIZE * 1.05}
                viewBox="0 0 280 280"
              >
                <Circle
                  cx="140"
                  cy="140"
                  r="130"
                  stroke="rgba(254, 240, 138, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="20 18"
                  fill="none"
                />
              </Svg>
            </Animated.View>

            {/* 3D Solar Core Chronometer */}
            <Animated.View style={[styles.coreBox, coreAnimStyle]}>
              <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
                <Defs>
                  <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
                    <Stop offset="50%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="#78350F" stopOpacity="0.95" />
                  </LinearGradient>
                  <LinearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#B45309" stopOpacity="0.7" />
                    <Stop offset="100%" stopColor="#451A03" stopOpacity="0.95" />
                  </LinearGradient>
                </Defs>

                {/* Dial Sphere Plate */}
                <Circle
                  cx="150"
                  cy="150"
                  r="98"
                  fill="url(#dialGrad)"
                  stroke="#FBBF24"
                  strokeWidth="3.2"
                />

                {/* Clock Hour Ticks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
                  (deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = 150 + Math.cos(rad) * 78;
                    const y1 = 150 + Math.sin(rad) * 78;
                    const x2 = 150 + Math.cos(rad) * 90;
                    const y2 = 150 + Math.sin(rad) * 90;
                    return (
                      <Path
                        key={deg}
                        d={`M ${x1} ${y1} L ${x2} ${y2}`}
                        stroke={deg % 90 === 0 ? "#FDE047" : "#F59E0B"}
                        strokeWidth={deg % 90 === 0 ? "3.2" : "1.8"}
                      />
                    );
                  }
                )}

                {/* Pulsing Sun Heart */}
                <Circle cx="150" cy="150" r="42" fill="url(#goldGrad)" />
                <Circle
                  cx="150"
                  cy="150"
                  r="58"
                  stroke="#FDE68A"
                  strokeWidth="1.8"
                  opacity={0.6}
                />

                {/* Watch Hands */}
                <Path
                  d="M 150 150 L 150 78"
                  stroke="#FFFFFF"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                />
                <Path
                  d="M 150 150 L 204 150"
                  stroke="#FDE047"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <Circle cx="150" cy="150" r="6.5" fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>
    );
  }

  // =========================================================================
  // SCENE 2: Emerald Crystal League & Aurora Constellation (Full Screen)
  // =========================================================================
  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.fullScreenCanvas}>
        {/* Emerald Radiance Backdrop */}
        <View
          style={[
            styles.ambientGlow,
            { backgroundColor: "#059669", opacity: 0.3 },
          ]}
        />

        {/* Full-Screen Vertical Laser Beams & Diamond Grid */}
        <View style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient id="emeraldFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#34D399" stopOpacity="0.02" />
                <Stop offset="35%" stopColor="#10B981" stopOpacity="0.22" />
                <Stop offset="70%" stopColor="#059669" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Vertical Aurora Force Beams */}
            {[0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88].map((fx, i) => (
              <Path
                key={`b-${i}`}
                d={`M ${width * fx} 0 L ${width * fx} ${height}`}
                stroke="url(#emeraldFade)"
                strokeWidth={i === 3 ? "2" : "1.2"}
                strokeDasharray={i % 2 === 0 ? "20 15" : "none"}
              />
            ))}
          </Svg>
        </View>

        {/* Central 3D Emerald Stage */}
        <View style={[styles.centerStage, { top: height * 0.32 }]}>
          {/* Diamond Polygon Forcefield */}
          <Animated.View style={[styles.ringLayer, ring1Style]}>
            <Svg
              width={SCENE_SIZE * 1.3}
              height={SCENE_SIZE * 1.3}
              viewBox="0 0 300 300"
            >
              <Polygon
                points="150,15 285,150 150,285 15,150"
                stroke="#34D399"
                strokeWidth="2.2"
                fill="none"
                strokeDasharray="22 15"
              />
              <Circle cx="150" cy="15" r="5" fill="#6EE7B7" />
              <Circle cx="285" cy="150" r="5" fill="#6EE7B7" />
              <Circle cx="150" cy="285" r="5" fill="#6EE7B7" />
              <Circle cx="15" cy="150" r="5" fill="#6EE7B7" />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.ringLayer, ring2Style]}>
            <Svg
              width={SCENE_SIZE * 1.15}
              height={SCENE_SIZE * 1.15}
              viewBox="0 0 300 300"
            >
              <Circle
                cx="150"
                cy="150"
                r="138"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="32 20 6 20"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {/* 3D Emerald Diamond Trophy Crystal */}
          <Animated.View style={[styles.coreBox, coreAnimStyle]}>
            <Svg width={SCENE_SIZE} height={SCENE_SIZE} viewBox="0 0 300 300">
              <Defs>
                <LinearGradient id="gemTopLeft" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor="#059669" stopOpacity="0.55" />
                </LinearGradient>
                <LinearGradient id="gemTopRight" x1="1" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.9" />
                  <Stop offset="100%" stopColor="#047857" stopOpacity="0.65" />
                </LinearGradient>
                <LinearGradient id="gemBotLeft" x1="0" y1="1" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#064E3B" stopOpacity="0.95" />
                  <Stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
                </LinearGradient>
                <LinearGradient id="gemBotRight" x1="1" y1="1" x2="0" y2="0">
                  <Stop offset="0%" stopColor="#022C22" stopOpacity="0.95" />
                  <Stop offset="100%" stopColor="#047857" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>

              {/* Diamond Crown */}
              <Polygon
                points="150,42 224,104 150,136 76,104"
                fill="url(#gemTopLeft)"
                stroke="#D1FAE5"
                strokeWidth="2"
              />
              {/* Upper Left Facet */}
              <Polygon
                points="76,104 150,136 150,228 76,166"
                fill="url(#gemBotLeft)"
                stroke="rgba(209,250,229,0.55)"
                strokeWidth="2"
              />
              {/* Upper Right Facet */}
              <Polygon
                points="150,136 224,104 224,166 150,228"
                fill="url(#gemTopRight)"
                stroke="rgba(209,250,229,0.55)"
                strokeWidth="2"
              />
              {/* Lower Pyramid Spike Left */}
              <Polygon
                points="150,228 76,166 150,272"
                fill="url(#gemBotLeft)"
                stroke="rgba(209,250,229,0.4)"
                strokeWidth="1.6"
              />
              {/* Lower Pyramid Spike Right */}
              <Polygon
                points="150,228 224,166 150,272"
                fill="url(#gemBotRight)"
                stroke="rgba(209,250,229,0.4)"
                strokeWidth="1.6"
              />

              {/* Luminous Heart Spark */}
              <Circle cx="150" cy="150" r="34" fill="#34D399" opacity={0.9} />
              <Circle
                cx="150"
                cy="150"
                r="52"
                stroke="#6EE7B7"
                strokeWidth="1.8"
                opacity={0.45}
              />

              {/* Vertex Nodes */}
              <Circle cx="150" cy="42" r="5" fill="#FFFFFF" />
              <Circle cx="224" cy="104" r="4.5" fill="#FFFFFF" />
              <Circle cx="76" cy="104" r="4.5" fill="#FFFFFF" />
              <Circle cx="150" cy="272" r="5" fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fullScreenCanvas: {
    width,
    height,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  ambientGlow: {
    position: "absolute",
    width: SCENE_SIZE * 1.35,
    height: SCENE_SIZE * 1.35,
    borderRadius: (SCENE_SIZE * 1.35) / 2,
    top: height * 0.16,
  },
  centerStage: {
    position: "absolute",
    width: SCENE_SIZE,
    height: SCENE_SIZE,
    alignItems: "center",
    justifyContent: "center",
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
