import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

interface ParticleDef {
  id: number;
  xPct: number;
  yPct: number;
  size: number;
  color: string;
  mass: number;
  baseOpacity: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const COLORS = [
  "#38bdf8", // cyan
  "#34d399", // emerald
  "#c084fc", // violet
  "#fbbf24", // amber
  "#f43f5e", // rose
  "#818cf8", // indigo
  "#2dd4bf", // teal
  "#ffffff", // starlight
];

// Pre-seeded pseudo-random generator for consistent, elegant distribution
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const PARTICLES: ParticleDef[] = Array.from({ length: 32 }, (_, i) => {
  const seed = (i + 1) * 37.17;
  const xPct = 5 + seededRandom(seed * 1.3) * 90;
  const yPct = 4 + seededRandom(seed * 2.7) * 92;
  const size = 2 + Math.floor(seededRandom(seed * 3.1) * 3.5);
  const color = COLORS[i % COLORS.length];
  const mass = 0.7 + seededRandom(seed * 4.9) * 1.8;
  const baseOpacity = 0.35 + seededRandom(seed * 5.3) * 0.45;

  return { id: i, xPct, yPct, size, color, mass, baseOpacity };
});

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 70,
  mass: 0.8,
};

function DustParticleView({
  def,
  gravity,
  touchX,
  touchY,
  touchActive,
}: {
  def: ParticleDef;
  gravity: ReturnType<typeof useAnimatedSensor>;
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  touchActive: SharedValue<number>;
}) {
  const originX = (def.xPct / 100) * SCREEN_W;
  const originY = (def.yPct / 100) * SCREEN_H;

  const animStyle = useAnimatedStyle(() => {
    // 1. Gyroscope / Gravity tilt effect
    const sensorX = gravity.sensor.value?.x ?? 0;
    const sensorY = gravity.sensor.value?.y ?? 0;

    // Invert X so tilting right moves particles right
    const tiltOffsetMultiplier = 18 * def.mass;
    const gx = -sensorX * tiltOffsetMultiplier;
    const gy = (sensorY - 5) * tiltOffsetMultiplier; // Adjust for natural 45° phone viewing angle

    let currentX = originX + gx;
    let currentY = originY + gy;

    // 2. Touch / Finger interaction (repulsion & gentle swirl around touch point)
    if (touchActive.value > 0.5) {
      const dx = currentX - touchX.value;
      const dy = currentY - touchY.value;
      const distSq = dx * dx + dy * dy;
      const radius = 110;

      if (distSq < radius * radius && distSq > 1) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / radius) * 48 * def.mass;
        const angle = Math.atan2(dy, dx);
        currentX += Math.cos(angle) * force;
        currentY += Math.sin(angle) * force;
      }
    }

    return {
      transform: [
        { translateX: currentX },
        { translateY: currentY },
      ],
      opacity: def.baseOpacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: def.size,
          height: def.size,
          borderRadius: def.size / 2,
          backgroundColor: def.color,
          shadowColor: def.color,
          shadowRadius: def.size * 2,
        },
        animStyle,
      ]}
      pointerEvents="none"
    />
  );
}

export const touchGlobalX = { value: 0 };
export const touchGlobalY = { value: 0 };
export const touchGlobalActive = { value: 0 };

export function GyroDustOverlay({
  touchX,
  touchY,
  touchActive,
}: {
  touchX?: SharedValue<number>;
  touchY?: SharedValue<number>;
  touchActive?: SharedValue<number>;
}) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 20 });

  const fallbackTouchX = useSharedValue(0);
  const fallbackTouchY = useSharedValue(0);
  const fallbackTouchActive = useSharedValue(0);

  const tX = touchX ?? fallbackTouchX;
  const tY = touchY ?? fallbackTouchY;
  const tActive = touchActive ?? fallbackTouchActive;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map((particle) => (
        <DustParticleView
          key={particle.id}
          def={particle}
          gravity={gravity}
          touchX={tX}
          touchY={tY}
          touchActive={tActive}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    elevation: 2,
  },
});
