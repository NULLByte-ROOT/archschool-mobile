import React, { useEffect, useState } from "react";
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
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import {
  loginAsGuest,
  loginWithGoogle,
  loginWithPassword,
  registerWithPassword,
} from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/tokens";

function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
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

  const topPadding = Math.max(insets.top, 24) + 24;
  const bottomPadding = Math.max(insets.bottom, 16) + 28;

  const [showPasswordForm, setShowPasswordForm] = useState(false);
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
      // Configuration fallback
    }
  }, []);

  // 1. One-Tap Google Account Picker
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

        // If existing user with active classroom, go straight home; otherwise setup
        if (res.user.google_id && !res.user.must_set_password) {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/onboarding/setup-schedule");
        }
      } else {
        setError("اطلاعات حساب گوگل دریافت نشد.");
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User closed the account chooser sheet — no error needed
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // Sign-in in progress
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("خدمات گوگل پلی روی دستگاه شما فعال یا به‌روز نیست.");
      } else {
        setError(err?.message || "خطا در اتصال به حساب گوگل");
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
          router.replace("/(tabs)/home");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در برقراری ارتباط با سرور");
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
              paddingTop: topPadding,
              paddingBottom: bottomPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar with Safe Clearance */}
          <View style={styles.navBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              style={styles.backButton}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>ورود به آرک‌اسکول</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Branding Section */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.heroSection}>
            <View style={styles.logoAura}>
              <LinearGradient
                colors={["#0284C7", "#0F172A"]}
                style={styles.logoGradient}
              >
                <Ionicons name="school" size={32} color="#38BDF8" />
              </LinearGradient>
            </View>
            <Text style={styles.mainHeading}>انتخاب روش ورود</Text>
            <Text style={styles.subHeading}>
              برای مدیریت هوشمند تکالیف، زنگ‌های مدرسه و حضور در کلاس‌های تیمی
            </Text>
          </Animated.View>

          {/* Error Message Box */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Primary Quick Login Options */}
          <Animated.View entering={FadeInDown.delay(180)} style={styles.quickOptionsGroup}>
            {/* Google One-Tap Action */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={googleLoading || guestLoading || loading}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={styles.socialBtnInner}>
                <GoogleIcon />
                <View style={styles.btnTextCol}>
                  <Text style={styles.googleBtnText}>ادامه با حساب گوگل</Text>
                  <Text style={styles.googleBtnSubtext}>انتخاب اکانت با یک لمس</Text>
                </View>
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Ionicons name="chevron-back" size={18} color="#94A3B8" />
                )}
              </View>
            </Pressable>

            {/* Instant Guest Mode Action */}
            <Pressable
              onPress={handleGuestSignIn}
              disabled={googleLoading || guestLoading || loading}
              style={({ pressed }) => [
                styles.guestButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={styles.socialBtnInner}>
                <View style={styles.guestIconBox}>
                  <Ionicons name="flash" size={18} color="#FBBF24" />
                </View>
                <View style={styles.btnTextCol}>
                  <Text style={styles.guestBtnText}>ورود سریع به عنوان مهمان</Text>
                  <Text style={styles.guestBtnSubtext}>تجربه کامل اپلیکیشن بدون ثبت‌نام</Text>
                </View>
                {guestLoading ? (
                  <ActivityIndicator size="small" color="#FBBF24" />
                ) : (
                  <Ionicons name="chevron-back" size={18} color={colors.muted} />
                )}
              </View>
            </Pressable>
          </Animated.View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>یا استفاده از نام کاربری و رمز</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Expandable Account Form Button / Card */}
          {!showPasswordForm ? (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPasswordForm(true);
              }}
              style={styles.expandButton}
            >
              <View style={styles.expandBtnInner}>
                <Ionicons name="key-outline" size={18} color={colors.accent} />
                <Text style={styles.expandBtnText}>
                  ورود یا ثبت‌نام با نام کاربری و رمز عبور
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </View>
            </Pressable>
          ) : (
            <Animated.View
              layout={Layout.springify()}
              entering={FadeInDown.duration(280)}
              style={styles.formCard}
            >
              {/* Switch Tab Capsule */}
              <View style={styles.switchCapsule}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsRegister(false);
                    setError(null);
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
                    setError(null);
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
                  placeholder="مثلاً: sepehr_arch"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>

              {/* Optional Email for Registration */}
              {isRegister && (
                <>
                  <Text style={styles.inputLabel}>ایمیل (اختیاری)</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={colors.muted} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="info@example.com"
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

              {/* Submit Button */}
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
                        {isRegister ? "ایجاد حساب و ادامه" : "ورود به حساب کاربری"}
                      </Text>
                      <Ionicons name="arrow-back" size={18} color={colors.onAccent} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#08080C",
  },
  scrollContent: {
    paddingHorizontal: 22,
  },
  navBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  headerBadgeText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 26,
  },
  logoAura: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: "rgba(56,189,248,0.15)",
    marginBottom: 16,
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  logoGradient: {
    flex: 1,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.4)",
  },
  mainHeading: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 24,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subHeading: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.danger,
    textAlign: "right",
  },
  quickOptionsGroup: {
    gap: 12,
    marginBottom: 24,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  socialBtnInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnTextCol: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: "flex-end",
  },
  googleBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: "#0F172A",
  },
  googleBtnSubtext: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  guestButton: {
    backgroundColor: "rgba(18,18,26,0.9)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  guestIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(251,191,36,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  guestBtnSubtext: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerLabel: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 12,
    color: colors.faint,
  },
  expandButton: {
    backgroundColor: "rgba(16,16,24,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  expandBtnInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandBtnText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 13,
    color: colors.muted,
    flex: 1,
    textAlign: "right",
    marginHorizontal: 8,
  },
  formCard: {
    backgroundColor: "rgba(16,16,24,0.95)",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  switchCapsule: {
    flexDirection: "row-reverse",
    backgroundColor: colors.inkRaised,
    borderRadius: 14,
    padding: 3,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  switchOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 11,
  },
  switchOptionActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  switchOptionText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  switchOptionTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: "#FFFFFF",
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
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "right",
  },
  submitButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
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
