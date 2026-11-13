import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import Svg, { Path } from "react-native-svg";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

import { loginAsGuest, loginWithGoogle, loginWithPassword, registerWithPassword } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/tokens";

const { width } = Dimensions.get("window");

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function OnboardingAuth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      GoogleSignin.configure({
        scopes: ["email", "profile"],
      });
    } catch {
      // Config fallback
    }
  }, []);

  // 1. Native Google One-Tap Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const user = response?.data?.user;

      if (user?.email) {
        const res = await loginWithGoogle({
          email: user.email.toLowerCase(),
          name: user.name || user.givenName || undefined,
          avatar_url: user.photo || undefined,
          google_id: user.id || undefined,
        });
        await setSession(res.access_token, res.user);
        router.replace("/onboarding/setup-schedule");
      } else {
        setError("اطلاعات حساب گوگل دریافت نشد.");
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled account picker dialog
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // already in progress
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("خدمات گوگل پلی روی دستگاه شما فعال نیست.");
      } else {
        setError(err?.message || "خطا در ورود با گوگل");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Fast Guest Mode
  const handleGuestSignIn = async () => {
    setGuestLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await loginAsGuest({
        nickname: "مهمان " + Math.floor(1000 + Math.random() * 9000),
      });
      await setSession(res.access_token, res.user);
      router.replace("/onboarding/setup-schedule");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ورود مهمان");
    } finally {
      setGuestLoading(false);
    }
  };

  // 3. Username & Password Auth
  const handleAccountAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setError("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isRegister) {
        const res = await registerWithPassword(username, password, email || undefined);
        await setSession(res.access_token, res.user);
        router.replace("/onboarding/setup-schedule");
      } else {
        const res = await loginWithPassword(username, password);
        await setSession(res.access_token, res.user);
        if (res.user.must_set_password) {
          router.replace("/onboarding/setup-account");
        } else {
          router.replace("/home");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 28,
              paddingBottom: insets.bottom + 30,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation Bar */}
          <View style={styles.navBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              style={styles.backButton}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>احراز هویت امن</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Header */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.heroSection}>
            <View style={styles.logoAura}>
              <Ionicons name="school" size={32} color={colors.accent} />
            </View>
            <Text style={styles.mainHeading}>ورود به آرک‌اسکول</Text>
            <Text style={styles.subHeading}>
              برای مدیریت تکالیف، زنگ‌ها و رقابت در کلاس، روش ورود خود را انتخاب کنید.
            </Text>
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Section 1: Social & Quick Actions */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.socialButtonsGroup}>
            {/* Google One-Tap Action */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading}
              style={styles.googleButton}
            >
              <View style={styles.socialBtnInner}>
                <GoogleIcon />
                <Text style={styles.googleBtnText}>ادامه با حساب گوگل</Text>
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <View style={styles.quickTag}>
                    <Text style={styles.quickTagText}>یک‌لمسی</Text>
                  </View>
                )}
              </View>
            </Pressable>

            {/* Guest Fast-Pass Action */}
            <Pressable
              onPress={handleGuestSignIn}
              disabled={guestLoading || loading}
              style={styles.guestButton}
            >
              <View style={styles.socialBtnInner}>
                <Ionicons name="flash" size={18} color={colors.warning} />
                <Text style={styles.guestBtnText}>ورود سریع مهمان (آفلاین)</Text>
                {guestLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.guestHint}>بدون نیاز به ثبت‌نام</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>

          {/* Elegant Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>یا با نام کاربری و رمز</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Section 2: Account Form Card (Login / Register) */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.formCard}>
            {/* Switch Capsule */}
            <View style={styles.switchCapsule}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsRegister(false);
                }}
                style={[styles.switchOption, !isRegister && styles.switchOptionActive]}
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    !isRegister && styles.switchOptionTextActive,
                  ]}
                >
                  ورود به حساب
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsRegister(true);
                }}
                style={[styles.switchOption, isRegister && styles.switchOptionActive]}
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    isRegister && styles.switchOptionTextActive,
                  ]}
                >
                  ثبت‌نام جدید
                </Text>
              </Pressable>
            </View>

            {/* Username Input */}
            <Text style={styles.inputLabel}>نام کاربری</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="مثلاً: sepehr_dev"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>

            {/* Optional Email on Register */}
            {isRegister && (
              <>
                <Text style={styles.inputLabel}>ایمیل (اختیاری جهت بازیابی)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    placeholderTextColor={colors.faint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                </View>
              </>
            )}

            {/* Password Input */}
            <Text style={styles.inputLabel}>رمز عبور</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="حداقل ۶ کاراکتر"
                placeholderTextColor={colors.faint}
                secureTextEntry={!showPassword}
                style={styles.textInput}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            {/* Submit Action Button */}
            <Pressable
              onPress={handleAccountAuth}
              disabled={loading}
              style={styles.submitButton}
            >
              <LinearGradient
                colors={[colors.accent, colors.accentDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <>
                    <Text style={styles.submitText}>
                      {isRegister ? "ایجاد حساب و ورود" : "ورود به حساب کاربری"}
                    </Text>
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
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: 22,
  },
  navBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerBadgeText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoAura: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  mainHeading: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 24,
    color: colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  subHeading: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
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
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.danger,
    textAlign: "right",
  },
  socialButtonsGroup: {
    gap: 12,
    marginBottom: 22,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#FFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  socialBtnInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: "#0F172A",
  },
  quickTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quickTagText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 10,
    color: "#64748B",
  },
  guestButton: {
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  guestBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 14,
    color: colors.text,
  },
  guestHint: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: colors.faint,
  },
  dividerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerLabel: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 12,
    color: colors.faint,
  },
  formCard: {
    backgroundColor: "rgba(15,15,22,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 20,
  },
  switchCapsule: {
    flexDirection: "row-reverse",
    backgroundColor: colors.inkRaised,
    borderRadius: 14,
    padding: 3,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  switchOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 11,
  },
  switchOptionActive: {
    backgroundColor: colors.white10,
  },
  switchOptionText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  switchOptionTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: colors.text,
  },
  inputLabel: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 6,
    marginTop: 2,
  },
  inputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
  },
  submitButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
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
