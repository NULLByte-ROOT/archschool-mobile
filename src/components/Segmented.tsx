import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

import { AppText } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  count?: number;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.root}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(option.key);
            }}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <AppText
              variant="label"
              color={active ? colors.amber : colors.muted}
              style={{ fontFamily: active ? fonts.semibold : fonts.medium }}
            >
              {option.label}
            </AppText>
            {typeof option.count === "number" ? (
              <AppText
                variant="caption"
                color={active ? colors.amber : colors.faint}
                ltr
                style={{ fontFamily: fonts.medium }}
              >
                {option.count}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row-reverse",
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(12,21,34,0.72)",
  },
  item: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  itemActive: {
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
});
