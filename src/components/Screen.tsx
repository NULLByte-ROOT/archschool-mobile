import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from "react-native-safe-area-context";

import { BlueprintGrid } from "@/components/BlueprintGrid";
import { colors, gradients } from "@/theme/tokens";

export function Screen({
  children,
  edges = ["top"],
  grid = true,
  underStatusBar = false,
  statusVeil = true,
}: {
  children: ReactNode;
  edges?: Edge[];
  grid?: boolean;
  /**
   * Let the app paint (and scroll) underneath the status bar the way iOS does:
   * the top inset is removed here and the screen itself adds it back as content
   * padding, while a frosted veil keeps the clock/battery readable.
   */
  underStatusBar?: boolean;
  /** Draw the frosted strip behind the clock (default on for `underStatusBar`). */
  statusVeil?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const safeEdges = underStatusBar
    ? edges.filter((edge) => edge !== "top")
    : edges;

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      {grid ? <BlueprintGrid /> : null}
      <SafeAreaView edges={safeEdges} style={styles.safe}>
        {children}
      </SafeAreaView>
      {underStatusBar && statusVeil && insets.top > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.veil, { height: insets.top }]}
        >
          <BlurView
            intensity={70}
            tint="systemChromeMaterialDark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(8,8,11,0.68)", "rgba(8,8,11,0.22)"]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  veil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: "hidden",
  },
});
