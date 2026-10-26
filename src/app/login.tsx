import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { ApiError, login, register } from "@/api/client";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type Mode = "login" | "register";

const CODE_LENGTH = 6;

/**
 * Glassmorphic sign-in plate — the mobile counterpart of the web login card.
 *
 * Design rules (task: "ultra-premium, minimal Persian"):
 *  - true-black canvas + one static white sheen (no animated glow),
 *  - English labels, at most one short Persian sentence,
 *  - six glass boxes for the access code, white filled button,
 *  - a single 240 ms fade-in, nothing bounces,
 *  - no debug text of any kind.
 */
export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"username" | "code" | null>(null);

  const codeRef = useRef<ComponentRef<typeof TextInput> | null>(null);

  const isRegister = mode === "register";

  const submit = async () => {
    if (submitting) return;
    setError(null);

    if (username.trim().length < 2) {
      setError("نام کاربری باید حداقل ۲ کاراکتر باشد.");
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("کد دسترسی باید ۶ کاراکتر انگلیسی یا عدد باشد.");
      return;
    }

    setSubmitting(true);
    try {
      const session = isRegister
        ? await register(username, code)
        : await login(username, code);
      await setSession(session.access_token, session.user);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => undefined);
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

  const changeCode = (value: string) => {
    setCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, CODE_LENGTH));
  };

  return (
    <Screen edges={["top", "bottom"]} grid>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.075)", "rgba(255,255,255,0)"]}
        style={styles.sheen}
      />

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(180)} style={styles.main}>
            <View style={styles.brandRow}>
              <View style={styles.logoPlate}>
                <Image
                  source={require("../../assets/logo.png")}
                  style={styles.logo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
              <View style={styles.brandText}>
                <AppText ltr style={styles.wordmark}>
                  ArchSchool
                </AppText>
                <AppText ltr style={styles.wordmarkSub}>
                  CLASS WORKSPACE
                </AppText>
              </View>
            </View>

            <View style={styles.headBlock}>
              <AppText ltr style={styles.eyebrow}>
                {isRegister ? "NEW ACCOUNT" : "WELCOME BACK"}
              </AppText>
              <AppText ltr style={styles.headline}>
                {isRegister ? "Join the studio." : "Sign in."}
              </AppText>
              <AppText style={styles.subline}>
                {isRegister
                  ? "با کد دسترسی، حساب تازه بساز."
                  : "برای ورود، کد دسترسی را وارد کن."}
              </AppText>
            </View>

            <View style={styles.card}>
              <AppText ltr style={styles.label}>
                USERNAME
              </AppText>
              <View
                style={[
                  styles.input,
                  focused === "username" && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={focused === "username" ? colors.text : colors.faint}
                />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused((current) => (current === "username" ? null : current))}
                  placeholder="your username"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={50}
                  returnKeyType="next"
                  onSubmitEditing={() => codeRef.current?.focus()}
                  selectionColor={colors.accent}
                  style={styles.inputText}
                />
              </View>

              <AppText ltr style={[styles.label, styles.labelSpaced]}>
                ACCESS CODE
              </AppText>

              <Pressable
                onPress={() => codeRef.current?.focus()}
                style={styles.codeRow}
                accessibilityLabel="کد دسترسی"
              >
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const filled = index < code.length;
                  const active = focused === "code" && index === code.length;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.codeBox,
                        filled && styles.codeBoxFilled,
                        active && styles.codeBoxActive,
                      ]}
                    >
                      <AppText ltr style={styles.codeChar}>
                        {code[index] ?? ""}
                      </AppText>
                    </View>
                  );
                })}
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={changeCode}
                  onFocus={() => setFocused("code")}
                  onBlur={() => setFocused((current) => (current === "code" ? null : current))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="default"
                  maxLength={CODE_LENGTH}
                  caretHidden
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  selectionColor={colors.accent}
                  style={styles.codeInput}
                />
              </Pressable>

              <AppText style={styles.hint}>
                ۶ کاراکتر — حروف بزرگ انگلیسی و عدد
              </AppText>

              {error ? (
                <View style={styles.error}>
                  <Ionicons name="alert-circle" size={14} color={colors.red} />
                  <AppText variant="caption" color={colors.red} style={styles.errorText}>
                    {error}
                  </AppText>
                </View>
              ) : null}

              <Pressable
                onPress={() => void submit()}
                disabled={submitting}
                style={[styles.button, submitting && styles.buttonBusy]}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <>
                    <AppText ltr style={styles.buttonText}>
                      {isRegister ? "CREATE ACCOUNT" : "CONTINUE"}
                    </AppText>
                    <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(isRegister ? "login" : "register");
                  setError(null);
                }}
                hitSlop={8}
                style={styles.switchRow}
              >
                <AppText ltr style={styles.switchText}>
                  {isRegister
                    ? "ALREADY HAVE A CODE? SIGN IN"
                    : "NO ACCOUNT? JOIN"}
                </AppText>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(180).delay(60)} style={styles.footer}>
            <View style={styles.footerRule} />
            <AppText ltr style={styles.devText}>
              DEVELOPED BY SEPEHR
            </AppText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: spacing.xxl,
  },
  main: { gap: 26 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoPlate: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  logo: { width: 32, height: 32 },
  brandText: { gap: 1 },
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: 0.6,
    color: colors.text,
  },
  wordmarkSub: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 2.6,
    color: colors.faint,
  },
  headBlock: { gap: 6 },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 3.2,
    color: colors.faint,
  },
  headline: {
    fontFamily: fonts.black,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: colors.text,
  },
  subline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "left",
  },
  card: {
    borderRadius: 26,
    padding: 20,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 2.4,
    color: colors.faint,
  },
  labelSpaced: { marginTop: 12 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inputText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: 0,
    textAlign: "left",
    writingDirection: "ltr",
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  codeBox: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  codeBoxFilled: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.20)",
  },
  codeBoxActive: {
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  codeChar: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  codeInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: "transparent",
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    lineHeight: 17,
    color: colors.faint,
    textAlign: "left",
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.32)",
    backgroundColor: colors.redSoft,
  },
  errorText: { flex: 1, textAlign: "left" },
  button: {
    marginTop: 10,
    height: 52,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
  },
  buttonBusy: { opacity: 0.75 },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.8,
    color: colors.onAccent,
  },
  switchRow: { alignSelf: "center", paddingVertical: 6 },
  switchText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.8,
    color: colors.muted,
  },
  footer: {
    marginTop: 30,
    alignItems: "center",
    gap: 12,
  },
  footerRule: {
    width: 26,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  devText: {
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 3.4,
    fontVariant: ["tabular-nums"],
    color: colors.faint,
  },
});
