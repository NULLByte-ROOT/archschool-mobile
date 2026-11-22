import { useEffect, useRef } from "react";
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { colors, radius } from "@/theme/tokens";

interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBox({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function AssignmentCardSkeleton() {
  return (
    <View style={styles.assignmentCard}>
      <View style={styles.cardHeader}>
        <SkeletonBox width={44} height={44} borderRadius={12} />
        <View style={styles.cardHeaderContent}>
          <SkeletonBox width="65%" height={16} borderRadius={6} />
          <SkeletonBox width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
          <View style={styles.metaRow}>
            <SkeletonBox width={55} height={18} borderRadius={radius.pill} />
            <SkeletonBox width={70} height={18} borderRadius={radius.pill} />
            <SkeletonBox width={85} height={18} borderRadius={radius.pill} />
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <SkeletonBox width={80} height={26} borderRadius={radius.pill} />
        <View style={{ flex: 1 }} />
        <SkeletonBox width={90} height={32} borderRadius={10} />
      </View>
    </View>
  );
}

export function LeaderboardItemSkeleton() {
  return (
    <View style={styles.leaderboardRow}>
      <SkeletonBox width={26} height={26} borderRadius={radius.pill} />
      <SkeletonBox width={38} height={38} borderRadius={radius.pill} />
      <View style={{ flex: 1, gap: 5 }}>
        <SkeletonBox width="50%" height={14} borderRadius={4} />
        <SkeletonBox width="30%" height={10} borderRadius={4} />
      </View>
      <SkeletonBox width={60} height={24} borderRadius={8} />
    </View>
  );
}

export function OverviewCardSkeleton() {
  return (
    <View style={styles.overviewCard}>
      <SkeletonBox width={32} height={32} borderRadius={8} />
      <SkeletonBox width="50%" height={24} borderRadius={6} style={{ marginTop: 10 }} />
      <SkeletonBox width="70%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  assignmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 14,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
  },
  cardHeaderContent: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  cardFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 10,
  },
  leaderboardRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 16,
  },
});
