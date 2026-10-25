import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ApiError, login, register } from "@/api/client";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/cards";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type Mode = "login" | "register";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const submit = async () => {
    if (submitting) return;
    setError(null);

    if (username.trim().length < 2) {
      setError("نام کاربری باید حداقل ۲ کاراکتر باشد.");
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("کد دسترسی دقیقاً ۶ کاراکتر انگلیسی یا عدد است. مثال: ROOT01");
      return;
    }

    setSubmitting(true);
    try {
      const session = isRegister
        ? await register(username, code)
        : await login(username, code);
      await setSession(session.access_token, session.user);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      router.replace("/home");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "ورود ناموفق بود. دوباره تلاش کنید.";
      setError(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={["top", "bottom"]} grid>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(480)} style={styles.brand}>
            <View style={styles.mark}>
              <Image
                source={require("../../assets/logo.png")}
                style={{ width: 30, height: 30 }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
            <View style={{ gap: 0 }}>
              <AppText
                variant="subtitle"
                ltr
                style={{ fontFamily: fonts.bold, letterSpacing: 0.4 }}
              >
                ArchSchool
              </AppText>
              <AppText variant="caption" color={colors.muted}>
                کارگاه کلاس یازدهم
              </AppText>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(520).delay(70)}>
            <AppText variant="display" style={styles.headline}>
              {isRegister ? "به تیم اضافه شو." : "به کارگاه برگرد."}
            </AppText>
            <AppText variant="body" color={colors.muted} style={styles.lede}>
              {isRegister
                ? "با نام کاربری و کد دسترسی، حساب تازه‌ات را بساز."
                : "تکالیف، گفتگو و رتبهٔ کلاس، همه در یک صفحه."}
            </AppText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(560).delay(130)}>
            <GlassCard glow style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.cardHead}>
                <AppText variant="strong">
                  {isRegister ? "ساخت حساب" : "ورود به حساب"}
                </AppText>
                <View style={styles.cardLine} />
              </View>

              <Field
                label="نام کاربری"
                value={username}
                onChangeText={setUsername}
                placeholder="مثلاً sepehr"
                icon="person-outline"
                autoCapitalize="none"
                maxLength={50}
                returnKeyType="next"
              />

              <Field
                label="کد دسترسی"
                value={code}
                onChangeText={(value) =>
                  setCode(
                    value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 6)
                  )
                }
                placeholder="ROOT01"
                hint="۶ کاراکتر، حروف بزرگ انگلیسی و عدد"
                icon="key-outline"
                ltr
                maxLength={6}
                autoCapitalize="characters"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                inputStyle={styles.codeInput}
              />

              {error ? (
                <View style={styles.error}>
                  <Ionicons name="alert-circle" size={15} color={colors.red} />
                  <AppText variant="caption" color={colors.red} style={{ flex: 1 }}>
                    {error}
                  </AppText>
                </View>
              ) : null}

              <Button
                label={isRegister ? "ساخت حساب و ورود" : "ورود به کارگاه"}
                icon={isRegister ? "person-add-outline" : "arrow-forward"}
                onPress={() => void submit()}
                loading={submitting}
              />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(560).delay(190)}>
            <Pressable
              onPress={() => {
                setMode(isRegister ? "login" : "register");
                setError(null);
              }}
              style={styles.switch}
              hitSlop={8}
            >
              <AppText variant="caption" color={colors.muted}>
                {isRegister ? "قبلاً حساب داشتید؟" : "هنوز حساب ندارید؟"}
              </AppText>
              <AppText variant="caption" color={colors.amber}>
                {isRegister ? "ورود" : "ساخت حساب"}
              </AppText>
            </Pressable>

            <View style={styles.footerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.faint} />
              <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
                بدون رمز عبور. اگر کد ندارید، از ادمین کلاس بگیرید.
              </AppText>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  brand: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  headline: { fontSize: 34, lineHeight: 46 },
  lede: { marginTop: 4, maxWidth: 320 },
  card: { marginTop: spacing.xs },
  cardContent: { padding: spacing.lg, gap: spacing.md },
  cardHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  codeInput: {
    textAlign: "center",
    letterSpacing: 7,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  error: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(242,104,107,0.35)",
    backgroundColor: colors.redSoft,
  },
  switch: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.xs,
  },
  footerNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
