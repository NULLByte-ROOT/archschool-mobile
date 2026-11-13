import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
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

import { loginAsGuest, loginWithGoogle, loginWithPassword, registerWithPassword } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/tokens";

type TabMode = "google" | "guest" | "account";

export default function OnboardingAuth() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [tab, setTab] = useState<TabMode>("google");
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTab = async (t: TabMode) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(t);
    setError(null);
  };

  // 1. Google Sign-In
  const handleGoogleAuth = async () => {
    if (!googleEmail.trim()) {
      setError("لطفاً آدرس ایمیل گوگل را وارد کنید.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await loginWithGoogle({
        email: googleEmail.trim().toLowerCase(),
        name: googleEmail.split("@")[0],
      });
      await setSession(res.access_token, res.user);
      router.replace("/onboarding/setup-schedule");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ورود با گوگل");
    } finally {
      setLoading(false);
    }
  };

  // 2. Guest Login
  const handleGuestAuth = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  // 3. Username / Password Login or Register
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
      setError(err instanceof Error ? err.message : "خطا در ورود یا ثبت‌نام");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>ورود به حساب</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Subtitle */}
          <Text style={styles.mainPrompt}>روش ورود خود را انتخاب کنید</Text>
          <Text style={styles.subPrompt}>
            می‌توانید با گوگل، اکانت مهمان یا نام کاربری اختصاصی وارد شوید.
          </Text>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => switchTab("account")}
              style={[styles.tabItem, tab === "account" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "account" && styles.tabTextActive,
                ]}
              >
                رمز عبور
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchTab("guest")}
              style={[styles.tabItem, tab === "guest" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "guest" && styles.tabTextActive,
                ]}
              >
                ورود مهمان
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchTab("google")}
              style={[styles.tabItem, tab === "google" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "google" && styles.tabTextActive,
                ]}
              >
                گوگل
              </Text>
            </Pressable>
          </View>

          {/* Error Message */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Tab 1: Google */}
          {tab === "google" && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="logo-google" size={32} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>ورود مستقیم با گوگل</Text>
              <Text style={styles.cardDesc}>
                ایمیل گوگل خود را وارد کنید تا حساب شما فوراً فعال و همگام‌سازی شود.
              </Text>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <TextInput
                  value={googleEmail}
                  onChangeText={setGoogleEmail}
                  placeholder="name@gmail.com"
                  placeholderTextColor={colors.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={handleGoogleAuth}
                disabled={loading}
                style={styles.actionBtn}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDeep]}
                  style={styles.actionGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <>
                      <Text style={styles.actionText}>ادامه با گوگل</Text>
                      <Ionicons name="logo-google" size={18} color={colors.onAccent} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {/* Tab 2: Guest */}
          {tab === "guest" && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: colors.white07 }]}>
                <Ionicons name="flash-outline" size={32} color={colors.warning} />
              </View>
              <Text style={styles.cardTitle}>ورود مهمان و حالت آفلاین</Text>
              <Text style={styles.cardDesc}>
                بدون نیاز به ثبت مشخصات، از تمام امکانات شخصی جدول زمانی و تکالیف آفلاین استفاده کنید. هر زمان خواستید می‌توانید به حساب رسمی ارتقا دهید.
              </Text>

              <Pressable
                onPress={handleGuestAuth}
                disabled={loading}
                style={styles.actionBtn}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDeep]}
                  style={styles.actionGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <>
                      <Text style={styles.actionText}>شروع سریع بدون ثبت‌نام</Text>
                      <Ionicons name="arrow-back" size={18} color={colors.onAccent} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {/* Tab 3: Account (User / Password) */}
          {tab === "account" && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
              <View style={styles.switchAuthRow}>
                <Pressable
                  onPress={() => setIsRegister(false)}
                  style={[styles.switchAuthItem, !isRegister && styles.switchAuthActive]}
                >
                  <Text
                    style={[
                      styles.switchAuthText,
                      !isRegister && styles.switchAuthTextActive,
                    ]}
                  >
                    ورود به حساب
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsRegister(true)}
                  style={[styles.switchAuthItem, isRegister && styles.switchAuthActive]}
                >
                  <Text
                    style={[
                      styles.switchAuthText,
                      isRegister && styles.switchAuthTextActive,
                    ]}
                  >
                    ثبت‌نام جدید
                  </Text>
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={colors.muted} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="نام کاربری (حداقل ۲ نویسه)"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              {isRegister && (
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={colors.muted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="ایمیل (اختیاری)"
                    placeholderTextColor={colors.faint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="رمز عبور (حداقل ۶ نویسه)"
                  placeholderTextColor={colors.faint}
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={handleAccountAuth}
                disabled={loading}
                style={styles.actionBtn}
              >
                <LinearGradient
                  colors={[colors.accent, colors.accentDeep]}
                  style={styles.actionGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <>
                      <Text style={styles.actionText}>
                        {isRegister ? "ایجاد حساب کاربری" : "ورود به حساب"}
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
    </SafeAreaView>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  mainPrompt: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 22,
    color: colors.text,
    textAlign: "right",
    marginTop: 18,
    marginBottom: 6,
  },
  subPrompt: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 24,
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: "row-reverse",
    backgroundColor: colors.panelSolid,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: colors.white10,
  },
  tabText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 13,
    color: colors.muted,
  },
  tabTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: colors.text,
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
  card: {
    backgroundColor: colors.panelPhone,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  cardDesc: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    width: "100%",
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
  },
  actionBtn: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  actionGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  actionText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.onAccent,
  },
  switchAuthRow: {
    flexDirection: "row-reverse",
    width: "100%",
    backgroundColor: colors.inkRaised,
    borderRadius: 14,
    padding: 3,
    marginBottom: 18,
  },
  switchAuthItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 11,
  },
  switchAuthActive: {
    backgroundColor: colors.white08,
  },
  switchAuthText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  switchAuthTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: colors.text,
  },
});
