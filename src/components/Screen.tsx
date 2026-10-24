import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { BlueprintGrid } from "@/components/BlueprintGrid";
import { colors, gradients } from "@/theme/tokens";

export function Screen({
  children,
  edges = ["top"],
  grid = true,
}: {
  children: ReactNode;
  edges?: Edge[];
  grid?: boolean;
}) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      {grid ? <BlueprintGrid /> : null}
      <SafeAreaView edges={edges} style={styles.safe}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
});
