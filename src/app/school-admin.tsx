import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  fetchSchoolConfig,
  sendTestPushNotification,
  updateSchoolConfig,
} from "@/api/client";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { IconTile, Kicker, MonoLabel, Panel } from "@/components/webui";
import { isOwner, isStaff } from "@/lib/roles";
import { SUBJECT_LIST } from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
} from "@/theme/tokens";

export default function SchoolAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const owner = isOwner(user);
  const staff = isStaff(user);

  // Modular school subjects & teachers
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; name: string; teacher: string }>>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingConfig(true);
      try {
        const conf = await fetchSchoolConfig();
        if (active && conf?.subjects) {
          setSubjectsList(conf.subjects);
        }
      } catch {
        if (active) {
          setSubjectsList(SUBJECT_LIST.map((s) => ({ id: s.id, name: s.name, teacher: s.teacher })));
        }
      } finally {
        if (active) setLoadingConfig(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleUpdateSubjectTeacher = (id: string, newTeacher: string) => {
    setSubjectsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, teacher: newTeacher } : s))
    );
  };

  const handleSaveSchoolConfig = async () => {
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      await updateSchoolConfig({ subjects: subjectsList });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setConfigFeedback("تغییرات دروس و دبیران با موفقیت در کل سامانه و هوش مصنوعی ذخیره شد! ✅");
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setConfigFeedback("خطا در ذخیره تغییرات دروس.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Test notification state
  const [testTitle, setTestTitle] = useState("اعلان آزمایشی مدرسه");
  const [testBody, setTestBody] = useState("این یک پیام تستی برای بررسی سیستم اعلان‌ها است.");
  const [isSending, setIsSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSendTestNotification = async () => {
    setIsSending(true);
    setTestFeedback(null);
    try {
      // 1. Trigger local notification directly on device
      await Notifications.scheduleNotificationAsync({
        content: {
          title: testTitle.trim() || "اعلان آزمایشی مدرسه",
          body: testBody.trim() || "این یک پیام تستی است.",
          sound: true,
          data: { type: "admin_test", sentAt: Date.now() },
        },
        trigger: null,
      });

      // 2. Also try backend push test
      let serverMsg = "";
      try {
        const res = await sendTestPushNotification(testTitle.trim(), testBody.trim());
        if (res.sent > 0) {
          serverMsg = ` (${res.sent} توکن سرور فعال)`;
        }
      } catch {
        // Local notification already fired, server error is optional info
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setTestFeedback({
        success: true,
        message: `اعلان تستی با موفقیت روی دستگاه ارسال شد${serverMsg}.`,
      });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const detail = err instanceof ApiError ? err.message : "خطا در ارسال اعلان تستی";
      setTestFeedback({
        success: false,
        message: detail,
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!staff && !owner) {
    return (
      <Screen>
        <Header title="مدیریت مدرسه" onBack={() => router.back()} />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
          <AppText variant="title" style={{ marginTop: 16 }}>
            دسترسی محدود
          </AppText>
          <AppText color={colors.faint} align="center" style={{ marginTop: 8 }}>
            این بخش فقط مخصوص مدیران و کادر مدرسه است.
          </AppText>
          <View style={{ marginTop: 24 }}>
            <Button
              label="بازگشت به حساب"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="مدیریت مدرسه و کلاس"
        subtitle="تنظیمات کاربران، زنگ‌ها و اعلان‌های سیستم"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Banner */}
          <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <Ionicons name="shield-checkmark" size={24} color={colors.amber} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 14 }}>
                پنل فرماندهی و مدیریت
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 11.5, marginTop: 2 }}>
                تنظیمات کلاس و کاربران به صورت ایزوله از پروفایل فردی
              </AppText>
            </View>
          </View>

          {/* Section 1: User & Class Management */}
          <Kicker text="users & access" dot style={{ marginBottom: 8, marginTop: 12 }} />
          <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
            <MonoLabel style={{ marginBottom: 8 }}>// USERS</MonoLabel>

            <Pressable
              onPress={() => router.push("/users")}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="مدیریت کاربران"
            >
              <IconTile name="people" size={40} iconSize={18} tone={colors.amber} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21 }}>
                  مدیریت کاربران و اعضای کلاس
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 17, marginTop: 2 }}>
                  تعیین نقش‌ها (ادمین، دوست، عضو)، کدهای ورود و فعال‌سازی
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.faint} />
            </Pressable>
          </Panel>

          {/* Section 2: School Schedule & Bells */}
          <Kicker text="schedule & periods" dot style={{ marginBottom: 8 }} />
          <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
            <MonoLabel style={{ marginBottom: 8 }}>// BELLS & TIMETABLE</MonoLabel>

            {owner ? (
              <Pressable
                onPress={() => router.push("/admin-bells")}
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="تنظیمات زنگ‌های مدرسه"
              >
                <IconTile name="alarm" size={40} iconSize={18} tone={colors.white} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21 }}>
                    تنظیمات زنگ‌های مدرسه
                  </AppText>
                  <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 17, marginTop: 2 }}>
                    ساعت شروع و پایان زنگ‌ها (تنظیم ثانیه‌شمار و زنگ تفریح‌ها)
                  </AppText>
                </View>
                <Ionicons name="chevron-back" size={16} color={colors.faint} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.push("/timetable")}
              style={({ pressed }) => [
                styles.linkRow,
                owner && { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 4 },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="برنامه درسی هفتگی"
            >
              <IconTile name="calendar-outline" size={40} iconSize={18} tone={colors.textSoft} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21 }}>
                  برنامه درسی هفتگی
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 17, marginTop: 2 }}>
                  برنامه زنگ‌ها و دروس روزانه کلاس
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.faint} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/admin-subjects")}
              style={({ pressed }) => [
                styles.linkRow,
                { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 4 },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="مدیریت دروس، اساتید و موضوعات"
            >
              <IconTile name="library-outline" size={40} iconSize={18} tone={colors.amber} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21 }}>
                  مدیریت دروس، اساتید و موضوعات
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 17, marginTop: 2 }}>
                  تعریف ماژولار دروس، نام دبیران و موضوعات تکالیف
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.faint} />
            </Pressable>
          </Panel>

          {/* Section 3: Test Notifications */}
          <Kicker text="notifications testing" dot style={{ marginBottom: 8 }} />
          <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
            <MonoLabel style={{ marginBottom: 8 }}>// TEST NOTIFICATION</MonoLabel>

            <AppText color={colors.textSoft} style={{ fontSize: 12, lineHeight: 19, marginBottom: 12 }}>
              برای اطمینان از دریافت نوتیفیکیشن‌ها و سالم بودن ارتباط دستگاه با سیستم، می‌توانید یک اعلان آزمایشی بفرستید:
            </AppText>

            <View style={styles.inputGroup}>
              <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                عنوان اعلان آزمایشی
              </AppText>
              <TextInput
                value={testTitle}
                onChangeText={setTestTitle}
                placeholder="عنوان پیام..."
                placeholderTextColor={colors.faint}
                style={styles.textInput}
                textAlign="right"
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                متن پیام اعلان
              </AppText>
              <TextInput
                value={testBody}
                onChangeText={setTestBody}
                placeholder="متن پیام آزمایشی..."
                placeholderTextColor={colors.faint}
                style={[styles.textInput, styles.multilineInput]}
                multiline
                numberOfLines={2}
                textAlign="right"
              />
            </View>

            {testFeedback ? (
              <View
                style={[
                  styles.feedbackBox,
                  {
                    backgroundColor: testFeedback.success
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                    borderColor: testFeedback.success
                      ? "rgba(16, 185, 129, 0.3)"
                      : "rgba(239, 68, 68, 0.3)",
                  },
                ]}
              >
                <Ionicons
                  name={testFeedback.success ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={testFeedback.success ? colors.emerald : colors.danger}
                />
                <AppText
                  color={testFeedback.success ? colors.emerald : colors.danger}
                  style={{ fontSize: 11.5, flex: 1, lineHeight: 18 }}
                >
                  {testFeedback.message}
                </AppText>
              </View>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <Button
                label={isSending ? "در حال ارسال اعلان..." : "ارسال اعلان تستی"}
                icon={isSending ? undefined : "paper-plane-outline"}
                variant="primary"
                disabled={isSending}
                onPress={() => void handleSendTestNotification()}
              />
            </View>
          </Panel>

          {/* Section 4: AI & Telegram Bot */}
          <Kicker text="ai & telegram bot" dot style={{ marginBottom: 8 }} />
          <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
            <MonoLabel style={{ marginBottom: 8 }}>// ARTIFICIAL INTELLIGENCE & BOT</MonoLabel>

            <Pressable
              onPress={() => router.push("/admin-bot")}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="هوش مصنوعی و ربات تلگرام"
            >
              <IconTile name="sparkles" size={40} iconSize={18} tone={colors.amber} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21 }}>
                  هوش مصنوعی و ربات تلگرام
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 17, marginTop: 2 }}>
                  مدیریت سیستم پرامپت و لحن، تنظیمات API ارائه‌دهنده‌ها و ربات تلگرام
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={16} color={colors.faint} />
            </Pressable>
          </Panel>

          {/* Section: Modular School Subjects & Teachers */}
          <Kicker text="school subjects & teachers" dot style={{ marginBottom: 8 }} />
          <Panel corners contentStyle={styles.cardPad}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <IconTile name="book-outline" size={36} iconSize={18} tone={colors.amber} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5 }}>
                  مدیریت دروس و نام دبیران (ماژولار)
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, marginTop: 2 }}>
                  تغییر نام دبیر یا موضوع فوراً در کل سامانه، تلگرام و هوش مصنوعی اعمال می‌شود
                </AppText>
              </View>
            </View>

            {loadingConfig ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator color={colors.amber} />
                <AppText color={colors.faint} style={{ fontSize: 11, marginTop: 8 }}>
                  در حال بارگذاری دروس...
                </AppText>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 4 }}>
                {subjectsList.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: colors.panelSoft,
                      padding: 10,
                      borderRadius: radius.md,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>
                        {s.name}
                      </AppText>
                      <AppText color={colors.faint} style={{ fontSize: 10.5 }}>
                        کد یکتا: {s.id}
                      </AppText>
                    </View>
                    <View style={{ width: 140, flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                      <AppText color={colors.faint} style={{ fontSize: 11 }}>
                        دبیر:
                      </AppText>
                      <TextInput
                        value={s.teacher}
                        onChangeText={(txt) => handleUpdateSubjectTeacher(s.id, txt)}
                        style={{
                          flex: 1,
                          backgroundColor: colors.panelSolid,
                          borderWidth: 1,
                          borderColor: colors.line,
                          borderRadius: radius.sm,
                          color: colors.white,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          fontSize: 12,
                          fontFamily: fonts.medium,
                          textAlign: "right",
                        }}
                        placeholder="نام دبیر"
                        placeholderTextColor={colors.faint}
                      />
                    </View>
                  </View>
                ))}

                {configFeedback ? (
                  <View
                    style={[
                      styles.feedbackBox,
                      { borderColor: colors.emerald, marginTop: 8 },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
                    <AppText color={colors.emerald} style={{ fontSize: 11.5, flex: 1, lineHeight: 18 }}>
                      {configFeedback}
                    </AppText>
                  </View>
                ) : null}

                <View style={{ marginTop: 8 }}>
                  <Button
                    label={savingConfig ? "در حال ذخیره..." : "ذخیره تغییرات دروس و دبیران"}
                    icon={savingConfig ? undefined : "save-outline"}
                    variant="primary"
                    disabled={savingConfig || loadingConfig}
                    onPress={() => void handleSaveSchoolConfig()}
                  />
                </View>
              </View>
            )}
          </Panel>

          {/* Section 4: System Diagnostics */}
          <Kicker text="system status" dot style={{ marginBottom: 8 }} />
          <Panel corners contentStyle={styles.cardPad}>
            <MonoLabel style={{ marginBottom: 8 }}>// DIAGNOSTICS</MonoLabel>
            <View style={styles.diagRow}>
              <AppText color={colors.faint} style={{ fontSize: 12 }}>
                نقش شما در سیستم:
              </AppText>
              <AppText color={colors.white} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                {owner ? "مالک کل (Owner)" : "مدیر مدرسه (Admin)"}
              </AppText>
            </View>
            <View style={styles.diagRow}>
              <AppText color={colors.faint} style={{ fontSize: 12 }}>
                دامنه سرور:
              </AppText>
              <AppText color={colors.textSoft} ltr style={{ fontFamily: fonts.medium, fontSize: 11.5 }}>
                archschool.vidxsepehr.ir
              </AppText>
            </View>
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
  },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  banner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 179, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 179, 0, 0.22)",
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 179, 0, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPad: {
    padding: 14,
  },
  linkRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: fonts.medium,
  },
  textInput: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  multilineInput: {
    minHeight: 56,
    textAlignVertical: "top",
  },
  feedbackBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 12,
  },
  diagRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  providerChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  providerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  providerChipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
});
