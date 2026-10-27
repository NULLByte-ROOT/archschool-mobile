import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  deleteMyAvatar,
  fetchNotificationPreferences,
  qk,
  updateMe,
  updateNotificationPreferences,
  uploadFile,
} from "@/api/client";
import type { NotificationPreferences, Role } from "@/api/types";
import { Screen } from "@/components/Screen";
import { AppText, Avatar } from "@/components/ui";
import { Corners, IconTile, Kicker, MonoLabel, Panel, PulseDot } from "@/components/webui";
import { fmtNum, lastSeenLabel, parseDue } from "@/lib/format";
import { isOwner, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

function roleText(role: Role, isAdmin: boolean): string {
  if (role === "owner") return "مالک (Owner)";
  if (role === "admin" || isAdmin) return "ادمین";
  if (role === "friend") return "دوست (Friend)";
  return "عضو";
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRight}>
        <Ionicons name={icon} size={15} color={colors.faint} />
        <MonoLabel>{label}</MonoLabel>
      </View>
      <AppText
        numberOfLines={1}
        ltr={mono}
        color={colors.text}
        style={{ fontSize: 14, lineHeight: 21, flexShrink: 1, textAlign: "left" }}
      >
        {value}
      </AppText>
    </View>
  );
}

/** A settings switch with a Persian label and an English mono key. */
function ToggleRow({
  icon,
  label,
  hint,
  value,
  busy,
  disabled,
  onToggle,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  hint: string;
  value: boolean;
  busy?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.85 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: disabled || busy }}
      accessibilityLabel={label}
    >
      <View style={styles.toggleLead}>
        <View style={styles.toggleIcon}>
          <Ionicons name={icon} size={15} color={colors.textSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 19 }}>
            {label}
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 16 }}>
            {hint}
          </AppText>
        </View>
      </View>
      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? colors.white : colors.white10 },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            {
              backgroundColor: value ? colors.onAccent : colors.textSoft,
              alignSelf: value ? "flex-end" : "flex-start",
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const [bio, setBio] = useState(user?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- notification preferences (server-side, per push token) ---- */
  const prefsQuery = useQuery({
    queryKey: qk.notificationPrefs,
    queryFn: fetchNotificationPreferences,
    staleTime: 60_000,
    retry: 1,
  });
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPref, setSavingPref] = useState<keyof NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs || savingPref) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsError(null);
    setPrefs(next);
    setSavingPref(key);
    try {
      const saved = await updateNotificationPreferences(next);
      setPrefs(saved);
      queryClient.setQueryData(qk.notificationPrefs, saved);
      void Haptics.selectionAsync().catch(() => undefined);
    } catch (toggleError) {
      setPrefs(previous);
      setPrefsError(
        toggleError instanceof ApiError
          ? toggleError.message
          : "ذخیرهٔ تنظیمات اعلان انجام نشد."
      );
    } finally {
      setSavingPref(null);
    }
  };

  const version = Constants.expoConfig?.version ?? "1.0.2";
  const role = (user?.role ?? "member") as Role;
  const staff = isStaff(user);
  const owner = isOwner(user);

  const syncUser = async (next: Awaited<ReturnType<typeof updateMe>>) => {
    await setUser(next);
    void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
    void queryClient.invalidateQueries({ queryKey: qk.userStats(next.id) });
    setBio(next.bio ?? "");
  };

  const pickAvatar = async () => {
    if (uploading || deleting) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize,
      });
      const updated = await updateMe({ avatar_url: uploaded.url });
      await syncUser(updated);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError ? uploadError.message : "آپلود تصویر ناموفق بود"
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (uploading || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const updated = await deleteMyAvatar();
      await syncUser(updated);
    } catch (removeError) {
      setError(
        removeError instanceof ApiError ? removeError.message : "حذف تصویر ناموفق بود"
      );
    } finally {
      setDeleting(false);
    }
  };

  const saveBio = async () => {
    if (savingBio) return;
    setSavingBio(true);
    setError(null);
    try {
      const updated = await updateMe({ bio: bio.trim() });
      await syncUser(updated);
      setBioSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      setTimeout(() => setBioSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "ذخیره بیو ناموفق بود");
    } finally {
      setSavingBio(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("خروج از حساب", "مطمئنی می‌خواهی از حساب خارج شوی؟", [
      { text: "انصراف", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: () => {
          queryClient.clear();
          void logout();
        },
      },
    ]);
  };

  const checkForUpdate = async () => {
    if (checkingUpdate) return;
    if (!Updates.isEnabled) {
      Alert.alert(
        "به‌روزرسانی",
        "در این نسخه (Expo Go یا development build) به‌روزرسانی هوایی فعال نیست. نسخهٔ نصب‌شده از EAS به‌طور خودکار بررسی می‌شود."
      );
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert("به‌روزرسانی آماده است", "برای اعمال نسخهٔ تازه، برنامه بازنشانی شود؟", [
          { text: "بعداً", style: "cancel" },
          { text: "بازنشانی", onPress: () => void Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert("به‌روزرسانی", "نسخهٔ نصب‌شده به‌روز است.");
      }
    } catch {
      Alert.alert("به‌روزرسانی", "بررسی به‌روزرسانی ممکن نشد. بعداً تلاش کن.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const memberSince = user?.created_at
    ? parseDue(user.created_at)?.toLocaleDateString("fa-IR-u-nu-latn") ?? "—"
    : "—";

  return (
    <Screen edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
      >
        <View style={{ marginBottom: 20 }}>
          <Kicker text="settings" dot style={{ marginBottom: 10 }} />
          <AppText style={{ fontFamily: fonts.black, fontSize: 24, lineHeight: 33, letterSpacing: -0.4 }}>
            تنظیمات
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
            حساب کاربری و اطلاعات سیستم
          </AppText>
        </View>

        {/* account */}
        <Panel corners contentStyle={styles.accountPad} style={{ marginBottom: 16 }}>
          <View style={styles.accountHead}>
            <View style={{ width: 76, height: 76 }}>
              <Avatar name={user?.username} uri={user?.avatar_url} size="xl" ring />
              <Pressable
                onPress={() => void pickAvatar()}
                disabled={uploading || deleting}
                style={[styles.avatarFab, { left: -4, bottom: -4 }]}
                accessibilityRole="button"
                accessibilityLabel="تغییر تصویر پروفایل"
                hitSlop={6}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={colors.white} />
                )}
              </Pressable>
              {user?.avatar_url ? (
                <Pressable
                  onPress={() => void removeAvatar()}
                  disabled={deleting || uploading}
                  style={[styles.avatarFab, styles.avatarFabDanger, { right: -4, bottom: -4 }]}
                  accessibilityRole="button"
                  accessibilityLabel="حذف عکس پروفایل"
                  hitSlop={6}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={13} color={colors.danger} />
                  )}
                </Pressable>
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText
                ltr
                numberOfLines={1}
                style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 }}
              >
                {user?.username ?? "—"}
              </AppText>
              <View style={styles.accountMeta}>
                <View style={styles.badge}>
                  <PulseDot size={5} tone={colors.white} />
                  <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
                    {user?.is_admin ? "admin" : "user"}
                  </AppText>
                </View>
                <MonoLabel>{role.toUpperCase()}</MonoLabel>
              </View>
            </View>
          </View>

          {/* bio */}
          <View style={{ marginTop: 20 }}>
            <View style={styles.bioHead}>
              <MonoLabel>BIO</MonoLabel>
              <AppText ltr color={colors.faint} style={{ fontSize: 10, lineHeight: 14 }}>
                {fmtNum(bio.length)}/200
              </AppText>
            </View>
            <TextInput
              value={bio}
              onChangeText={(value) => {
                setBio(value);
                setBioSaved(false);
              }}
              maxLength={200}
              multiline
              placeholder="یک بیو کوتاه درباره خودت بنویس…"
              placeholderTextColor={colors.faint}
              style={styles.bioInput}
              textAlignVertical="top"
              accessibilityLabel="بیوگرافی"
            />
            <View style={styles.bioFoot}>
              <AppText
                numberOfLines={2}
                color={error ? colors.danger : colors.faint}
                style={{ fontSize: 11, lineHeight: 17, flex: 1 }}
              >
                {error ? error : bioSaved ? "ذخیره شد" : "برای نمایش در پروفایل"}
              </AppText>
              <Pressable
                onPress={() => void saveBio()}
                disabled={savingBio || bio.trim() === (user?.bio ?? "")}
                style={({ pressed }) => [
                  styles.ghostButton,
                  (savingBio || bio.trim() === (user?.bio ?? "")) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="ذخیره بیو"
              >
                {savingBio ? (
                  <ActivityIndicator size="small" color={colors.textSoft} />
                ) : bioSaved ? (
                  <Ionicons name="checkmark" size={13} color={colors.textSoft} />
                ) : null}
                <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
                  ذخیره بیو
                </AppText>
              </Pressable>
            </View>
          </View>

          {/* info rows */}
          <View style={styles.infoBlock}>
            <InfoRow icon="finger-print" label="USERNAME" value={user?.username ?? "—"} mono />
            <InfoRow
              icon="shield-checkmark"
              label="ROLE"
              value={roleText(role, Boolean(user?.is_admin))}
            />
            <InfoRow icon="hardware-chip" label="STATUS" value={user?.is_active ? "فعال" : "غیرفعال"} />
            <InfoRow icon="calendar" label="MEMBER SINCE" value={memberSince} />
            <InfoRow icon="time" label="LAST SEEN" value={lastSeenLabel(user?.last_seen)} />
          </View>
        </Panel>

        {/* notifications */}
        <Panel corners contentStyle={styles.accountPad} style={{ marginBottom: 16 }}>
          <View style={styles.prefHead}>
            <MonoLabel>// NOTIFICATIONS</MonoLabel>
            {prefsQuery.isLoading || savingPref ? (
              <ActivityIndicator size="small" color={colors.faint} />
            ) : (
              <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 15 }}>
                {prefsQuery.isError ? "بدون اتصال" : "فعال برای این دستگاه"}
              </AppText>
            )}
          </View>
          <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 18, marginBottom: 10 }}>
            اعلان‌ها فقط برای همین دستگاه ذخیره می‌شوند.
          </AppText>

          {prefs ? (
            <>
              <ToggleRow
                icon="chatbubble-ellipses"
                label="گفتگوها"
                hint="پیام کلاس، خصوصی و کامنت تکالیف"
                value={prefs.chat}
                busy={savingPref === "chat"}
                onToggle={() => void togglePref("chat")}
              />
              <ToggleRow
                icon="clipboard"
                label="تکالیف تازه"
                hint="وقتی ادمین تکلیف جدید ثبت می‌کند"
                value={prefs.assignments}
                busy={savingPref === "assignments"}
                onToggle={() => void togglePref("assignments")}
              />
              <ToggleRow
                icon="alarm"
                label="یادآوری مهلت"
                hint="۲۴ ساعت و ۲ ساعت پیش از پایان مهلت"
                value={prefs.deadlines}
                busy={savingPref === "deadlines"}
                onToggle={() => void togglePref("deadlines")}
              />
            </>
          ) : (
            <Pressable
              onPress={() => void prefsQuery.refetch()}
              style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={13} color={colors.textSoft} />
              <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
                دریافت تنظیمات اعلان
              </AppText>
            </Pressable>
          )}

          {prefsError ? (
            <AppText color={colors.danger} style={{ fontSize: 10.5, lineHeight: 16, marginTop: 8 }}>
              {prefsError}
            </AppText>
          ) : null}
        </Panel>

        {/* admin-only tools */}
        {staff ? (
          <Panel corners contentStyle={styles.accountPad} style={{ marginBottom: 16 }}>
            <MonoLabel style={{ marginBottom: 8 }}>// ADMIN</MonoLabel>
            <Pressable
              onPress={() => router.push("/admin-bells")}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="تنظیمات زنگ‌های مدرسه"
            >
              <IconTile name="alarm" size={36} iconSize={16} tone={colors.white} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 20 }}>
                  تنظیمات زنگ‌های مدرسه
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 16 }}>
                  شروع و پایان چهار زنگ روزانه — روی همهٔ شمارش معکوس‌ها اثر دارد
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={15} color={colors.faint} />
            </Pressable>
          </Panel>
        ) : null}

        {/* session */}
        <Panel corners contentStyle={styles.accountPad} style={{ marginBottom: 16 }}>
          <MonoLabel style={{ marginBottom: 4 }}>// SESSION</MonoLabel>
          <AppText color={colors.faint} style={{ fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
            از حساب کاربری خارج شو
          </AppText>
          <Pressable
            onPress={confirmLogout}
            style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="خروج از حساب"
          >
            <Ionicons name="log-out-outline" size={15} color={colors.danger} />
            <AppText color={colors.danger} style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
              خروج از حساب
            </AppText>
          </Pressable>
        </Panel>

        {/* mobile-only management + updates */}
        <Panel corners contentStyle={styles.accountPad} style={{ marginBottom: 16 }}>
          <MonoLabel style={{ marginBottom: 8 }}>// APP</MonoLabel>
          {staff ? (
            <Pressable
              onPress={() => router.push("/users")}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <IconTile name="people" size={36} iconSize={16} tone={colors.white} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 20 }}>
                  مدیریت کاربران
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 16 }}>
                  نقش‌ها، کد دسترسی و فعال‌سازی اعضا
                </AppText>
              </View>
              <Ionicons name="chevron-back" size={15} color={colors.faint} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void checkForUpdate()}
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <IconTile
              name="cloud-download"
              size={36}
              iconSize={16}
              tone={colors.textSoft}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 20 }}>
                {checkingUpdate ? "در حال بررسی…" : "بررسی به‌روزرسانی"}
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 16 }}>
                دریافت نسخهٔ تازه بدون نصب مجدد
              </AppText>
            </View>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color={colors.faint} />
            ) : (
              <Ionicons name="chevron-back" size={15} color={colors.faint} />
            )}
          </Pressable>

          {owner ? (
            <View style={styles.ownerHint}>
              <Ionicons name="shield-checkmark" size={12} color={colors.amber} />
              <AppText color={colors.amber} style={{ fontSize: 10.5, lineHeight: 16, flex: 1 }}>
                حساب مالک — دسترسی کامل به آمار سرور و کدهای کاربران.
              </AppText>
            </View>
          ) : null}
        </Panel>

        {/* about */}
        <Panel corners contentStyle={styles.accountPad}>
          <MonoLabel style={{ marginBottom: 8 }}>// ABOUT</MonoLabel>
          <View style={styles.aboutRow}>
            <AppText color={colors.text} style={{ fontSize: 14, lineHeight: 21 }}>
              ArchSchool
            </AppText>
            <AppText ltr color={colors.faint} style={{ fontFamily: fonts.medium, fontSize: 12 }}>
              v{version}
            </AppText>
          </View>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
  },
  accountPad: { padding: 16 },
  accountHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
  },
  accountMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  avatarFab: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: colors.black,
  },
  prefHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  toggleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.white08,
  },
  toggleLead: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  toggleIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 3,
    justifyContent: "center",
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  avatarFabDanger: {
    borderColor: "rgba(248,113,113,0.40)",
  },
  bioHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  bioInput: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "right",
  },
  bioFoot: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  ghostButton: {
    minHeight: 36,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  infoBlock: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  infoRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  dangerButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.30)",
    backgroundColor: "transparent",
  },
  linkRow: {
    minHeight: 52,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  ownerHint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aboutRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
