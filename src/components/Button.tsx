import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { PressableScale } from "@/components/cards";
import { AppText, type IconName } from "@/components/ui";
import { colors, fonts, gradients, radius, spacing } from "@/theme/tokens";

type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";

export function Button({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = "primary",
  fullWidth = true,
  size = "md",
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  size?: "sm" | "md";
}) {
  const inactive = disabled || loading;
  const height = size === "sm" ? 40 : 50;

  const textColor =
    variant === "primary" ? "#09090b" : variant === "danger" ? colors.red : colors.text;
  const borderColor =
    variant === "ghost"
      ? colors.lineStrong
      : variant === "danger"
        ? "rgba(242,104,107,0.32)"
        : "transparent";
  const backgroundColor =
    variant === "ghost"
      ? "rgba(255,255,255,0.02)"
      : variant === "danger"
        ? colors.redSoft
        : variant === "subtle"
          ? colors.panelSolid
          : "transparent";

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      <View
        style={[
          styles.base,
          {
            height,
            borderColor,
            backgroundColor,
            borderWidth: variant === "primary" ? 0 : 1,
          },
        ]}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={gradients.amber}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <View style={styles.content}>
            {icon ? <Ionicons name={icon} size={17} color={textColor} /> : null}
            <AppText
              variant="strong"
              color={textColor}
              style={{ fontFamily: fonts.semibold, fontSize: size === "sm" ? 13 : 14.5 }}
            >
              {label}
            </AppText>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
  },
  content: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
});
