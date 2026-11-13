import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { setPassword } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/tokens";

export default function SetupAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const topPadding = Math.max(insets.top, 24) + 20;
  const bottomPadding = Math.max(insets.bottom, 16) + 24;

  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPasswordVal] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[a-zA-Z]/.test(pwd)) score += 1;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthLabels = ["خیلی ضعیف", "معمولی", "خوب", "عالی"];
  const strengthColors = [colors.danger, colors.warning, colors.blue, colors.emerald];

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ نویسه باشد.");
      return;
    }
    if (password !== confirmPassword) {
      setError("تکرار رمز عبور با رمز واردشده مطابقت ندارد.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updatedUser = await setPassword(password, username.trim() || undefined);
      await setUser(updatedUser);
      router.replace("/onboarding/setup-schedule");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در تنظیم رمز عبور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPadding, paddingBottom: bottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>ارتقای امنیت حساب</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Prompt */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <View style={styles.badgeShield}>
              <Ionicons name="shield-checkmark" size={36} color={colors.emerald} />
            </View>
            <Text style={styles.mainTitle}>رمز عبور حساب خود را تنظیم کنید</Text>
            <Text style={styles.subTitle}>
              برای محافظت از اطلاعات و ورود آسان از دستگاه‌های دیگر، یک رمز عبور امن انتخاب کنید.
            </Text>
          </Animated.View>

          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.formCard}>
            <Text style={styles.label}>نام کاربری</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="نام کاربری شما"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>رمز عبور جدید</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={18} color={colors.muted} />
              <TextInput
                value={password}
                onChangeText={setPasswordVal}
                placeholder="حداقل ۶ نویسه"
                placeholderTextColor={colors.faint}
                secureTextEntry
                style={styles.input}
              />
            </View>

            {/* Strength Meter */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.meterBars}>
                  {[0, 1, 2, 3].map((idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.bar,
                        idx < strength
                          ? { backgroundColor: strengthColors[strength - 1] }
                          : { backgroundColor: colors.white08 },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.strengthText,
                    { color: strength > 0 ? strengthColors[strength - 1] : colors.muted },
                  ]}
                >
                  {strength > 0 ? strengthLabels[strength - 1] : ""}
                </Text>
              </View>
            )}

            <Text style={styles.label}>تکرار رمز عبور</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="تکرار همان رمز"
                placeholderTextColor={colors.faint}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={styles.submitBtn}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDeep]}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <>
                    <Text style={styles.submitText}>ثبت رمز و ادامه</Text>
                    <Ionicons name="arrow-back" size={18} color={colors.onAccent} />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  badgeShield: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successLine,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  mainTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 22,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subTitle: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.danger,
    textAlign: "right",
  },
  formCard: {
    backgroundColor: colors.panelPhone,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
  },
  label: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
  },
  strengthRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  meterBars: {
    flexDirection: "row-reverse",
    gap: 4,
    flex: 1,
    maxWidth: 120,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 11,
  },
  submitBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 16,
  },
  submitGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  submitText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.onAccent,
  },
});
