import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLORS = [
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#EF4444", // red
  "#FCD34D", // gold
  "#6EE7B7", // teal
];

const PARTICLE_COUNT = 40;

interface ParticleData {
  id: number;
  color: string;
  size: number;
  isCircle: boolean;
  angle: number;
  distance: number;
  rotation: number;
  delay: number;
}

function generateParticles(): ParticleData[] {
  const list: ParticleData[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
    const distance = 120 + Math.random() * (SCREEN_WIDTH * 0.55);
    list.push({
      id: i,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
      isCircle: Math.random() > 0.4,
      angle,
      distance,
      rotation: Math.random() * 720 - 360,
      delay: Math.random() * 80,
    });
  }
  return list;
}

function ConfettiPiece({
  data,
  progress,
}: {
  data: ParticleData;
  progress: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    "worklet";
    const p = progress.value;
    const currentDist = data.distance * Math.min(1, p * 1.2);
    const tx = Math.cos(data.angle) * currentDist;
    // Add realistic gravity to y axis
    const ty = Math.sin(data.angle) * currentDist + p * p * 180;
    const rot = `${data.rotation * p}deg`;
    const opacity = p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.4);
    const scale = p < 0.2 ? p * 5 : Math.max(0.2, 1 - p * 0.5);

    return {
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: data.size,
          height: data.isCircle ? data.size : data.size * 1.6,
          backgroundColor: data.color,
          borderRadius: data.isCircle ? data.size / 2 : 2,
        },
        animStyle,
      ]}
    />
  );
}

export interface CelebrationBurstProps {
  active: boolean;
  onFinish?: () => void;
}

export function CelebrationBurst({ active, onFinish }: CelebrationBurstProps) {
  const progress = useSharedValue(0);
  const particles = useMemoParticles(active);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withTiming(
        1,
        {
          duration: 1200,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished && onFinish) {
            runOnJS(onFinish)();
          }
        }
      );
    }
  }, [active, onFinish, progress]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.centerAnchor}>
        {particles.map((p) => (
          <ConfettiPiece key={p.id} data={p} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function useMemoParticles(active: boolean) {
  return generateParticles();
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  centerAnchor: {
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
  },
});
