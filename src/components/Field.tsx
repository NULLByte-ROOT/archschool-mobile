import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { AppText, type IconName } from "@/components/ui";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  icon,
  ltr = false,
  maxLength,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  editable = true,
  multiline = false,
  returnKeyType,
  onSubmitEditing,
  inputStyle,
  autoFocus = false,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  ltr?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  editable?: boolean;
  multiline?: boolean;
  returnKeyType?: "done" | "next" | "go" | "send";
  onSubmitEditing?: () => void;
  inputStyle?: StyleProp<TextStyle>;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.red : focused ? colors.amberLine : colors.line;

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" color={colors.muted}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)",
            minHeight: multiline ? 96 : 50,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={focused ? colors.amber : colors.faint} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          autoCorrect={false}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          multiline={multiline}
          selectionColor={colors.amber}
          cursorColor={colors.amber}
          textAlignVertical={multiline ? "top" : "center"}
          style={[
            styles.input,
            {
              textAlign: ltr ? "left" : "right",
              writingDirection: ltr ? "ltr" : "rtl",
              minHeight: multiline ? 92 : undefined,
              paddingTop: multiline ? spacing.sm : 0,
            },
            ltr ? { fontFamily: fonts.medium } : null,
            inputStyle,
          ]}
        />
      </View>
      {error ? (
        <AppText variant="caption" color={colors.red}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.faint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, width: "100%" },
  field: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
