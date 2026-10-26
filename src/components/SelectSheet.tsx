import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Native stand-in for the web `Dropdown`: a calm bottom sheet with the same
 * options. The web opens a floating menu on mobile; a sheet keeps 44px touch
 * targets and never clips under the keyboard or the safe area.
 */
export function SelectSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="بستن">
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 }}>
              {title}
            </AppText>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="بستن"
              style={styles.close}
            >
              <Ionicons name="close" size={16} color={colors.textSoft} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value || "all"}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => undefined);
                    onSelect(option.value);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      numberOfLines={1}
                      color={active ? colors.white : colors.textSoft}
                      style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 13 }}
                    >
                      {option.label}
                    </AppText>
                    {option.description ? (
                      <AppText
                        numberOfLines={1}
                        color={colors.faint}
                        style={{ fontSize: 10.5, lineHeight: 15, marginTop: 1 }}
                      >
                        {option.description}
                      </AppText>
                    ) : null}
                  </View>
                  {active ? (
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.white10,
    backgroundColor: colors.inkRaised,
    paddingHorizontal: screenGutter,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white15,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: {
    borderColor: colors.white12,
    backgroundColor: colors.white06,
  },
});
