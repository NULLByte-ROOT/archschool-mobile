import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  ApiError,
  fetchUserStats,
  qk,
  updateMe,
  uploadFile,
} from "@/api/client";
import type { Role } from "@/api/types";
import { Button } from "@/components/Button";
import { GlassCard, SectionTitle, SolidCard, StatTile } from "@/components/cards";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { WeekBars } from "@/components/WeekBars";
import { AppText, Avatar, Divider, Pill, type IconName } from "@/components/ui";
import { faDate, fmtNum, fmtPercent } from "@/lib/format";
import { isOwner, isStaff, roleColor, roleLabel } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

function ActionRow({
  icon,
  label,
  hint,
  tone = colors.text,
  onPress,
  last = false,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  tone?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <>
      <Pressable onPress={onPress} style={styles.actionRow}>
        <View
          style={[
            styles.actionIcon,
            {
              borderColor:
                tone === colors.red ? "rgba(242,104,107,0.3)" : colors.line,
              backgroundColor:
                tone === colors.red ? colors.redSoft : "rgba(255,255,255,0.03)",
            },
          ]}
        >
          <Ionicons name={icon} size={17} color={tone} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="label" color={tone} style={{ fontFamily: fonts.semibold }}>
            {label}
          </AppText>
          {hint ? (
            <AppText variant="caption" color={colors.faint}>
              {hint}
            </AppText>
          ) : null}
        </View>
        <Ionicons name="chevron-back" size={14} color={colors.faint} />
      </Pressable>
      {!last ? <Divider /> : null}
    </>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const [editOpen, setEditOpen] = useState(false);
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const stats = useQuery({
    queryKey: qk.userStats(user?.id ?? 0),
    queryFn: () => fetchUserStats(user?.id ?? 0),
    enabled: Boolean(user?.id),
  });

  const version = Constants.expoConfig?.version ?? "1.0.0";
  const entry = stats.data;

  const openEdit = () => {
    setBio(user?.bio ?? "");
    setAvatarUrl(user?.avatar_url ?? "");
    setEditError(null);
    setEditOpen(true);
  };

  const pickAvatar = async () => {
    if (uploadingAvatar) return;
    setEditError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploadingAvatar(true);
      const uploaded = await uploadFile({
        uri: asset.uri,
        name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize,
      });
      setAvatarUrl(uploaded.url);
    } catch (error) {
      setEditError(
        error instanceof ApiError ? error.message : "بارگذاری تصویر ناموفق بود."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setEditError(null);
    try {
      const updated = await updateMe({
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
      });
      await setUser(updated);
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
      void queryClient.invalidateQueries({ queryKey: qk.userStats(updated.id) });
    } catch (error) {
      setEditError(
        error instanceof ApiError ? error.message : "ذخیرهٔ پروفایل ناموفق بود."
      );
    } finally {
      setSaving(false);
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

  const role = (user?.role ?? "member") as Role;
  const staff = isStaff(user);
  const owner = isOwner(user);

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={stats.isRefetching}
            onRefresh={() => void stats.refetch()}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <View style={styles.topBar}>
          <AppText variant="title">پروفایل</AppText>
          <Pill label={`نسخه ${version}`} tone="muted" icon="cube-outline" />
        </View>

        <Animated.View entering={FadeInDown.duration(420)}>
          <GlassCard contentStyle={styles.hero}>
            <Avatar
              name={user?.username}
              uri={user?.avatar_url}
              size="xl"
              ring
            />
            <View style={styles.heroText}>
              <AppText variant="title">{user?.username ?? "—"}</AppText>
              <View style={styles.heroPills}>
                <Pill
                  label={roleLabel(role)}
                  tone={roleColor(role) as "amber" | "teal" | "red" | "blue" | "muted"}
                  icon={owner ? "shield-checkmark-outline" : "person-outline"}
                />
                {user?.created_at ? (
                  <AppText variant="caption" color={colors.faint}>
                    از {faDate(user.created_at, "dayMonth")}
                  </AppText>
                ) : null}
              </View>
              <AppText
                variant="caption"
                color={user?.bio ? colors.textSoft : colors.faint}
                align="center"
                numberOfLines={3}
                style={{ marginTop: 2 }}
              >
                {user?.bio?.trim() || "بیوگرافی هنوز خالی است."}
              </AppText>
            </View>
            <Button
              label="ویرایش پروفایل"
              icon="create-outline"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={openEdit}
            />
          </GlassCard>
        </Animated.View>

        <View style={styles.statRow}>
          <StatTile
            label="رتبه"
            value={entry ? fmtNum(entry.rank) : "—"}
            icon="podium-outline"
            hint="جایگاه در تیم"
          />
          <StatTile
            label="درصد تحویل"
            value={entry ? fmtPercent(entry.completion_percentage) : "—"}
            icon="analytics-outline"
            tone={colors.teal}
          />
        </View>
        <View style={styles.statRow}>
          <StatTile
            label="زنجیره"
            value={entry ? `${fmtNum(entry.current_streak)} روز` : "—"}
            icon="flame-outline"
            tone={colors.red}
          />
          <StatTile
            label="بهترین"
            value={entry ? `${fmtNum(entry.best_streak)} روز` : "—"}
            icon="trophy-outline"
            tone={colors.amber}
          />
        </View>

        {entry ? (
          <SolidCard style={{ marginTop: spacing.md, padding: spacing.md, gap: spacing.sm }}>
            <View style={styles.weekHead}>
              <AppText variant="label" color={colors.muted}>
                فعالیت هفته
              </AppText>
              <AppText variant="caption" color={colors.faint}>
                {fmtNum(entry.completed_count)} از {fmtNum(entry.total_assignments)} تکلیف
              </AppText>
            </View>
            <View style={{ alignSelf: "center" }}>
              <WeekBars data={entry.weekly_activity} maxBarHeight={38} />
            </View>
          </SolidCard>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title="مدیریت" hint="دسترسی‌ها بر اساس نقش" />
          <SolidCard style={{ paddingHorizontal: spacing.md }}>
            {staff ? (
              <ActionRow
                icon="people-outline"
                label="مدیریت کاربران"
                hint="نقش‌ها، کد دسترسی و فعال‌سازی اعضا"
                onPress={() => router.push("/users")}
              />
            ) : null}
            <ActionRow
              icon="cloud-download-outline"
              label={checkingUpdate ? "در حال بررسی…" : "بررسی به‌روزرسانی"}
              hint="دریافت نسخهٔ تازه بدون نصب مجدد"
              onPress={() => void checkForUpdate()}
            />
            <ActionRow
              icon="information-circle-outline"
              label="دربارهٔ ArchSchool"
              hint="کارگاه کلاس یازدهم · نسخهٔ موبایل"
              onPress={() =>
                Alert.alert(
                  "ArchSchool",
                  `نسخهٔ موبایل ${version}\nکارگاه کلاس یازدهم\n\nگفتگو، تکالیف و رتبه‌بندی در یک فضای مشترک.`
                )
              }
            />
            <ActionRow
              icon="log-out-outline"
              label="خروج از حساب"
              tone={colors.red}
              onPress={confirmLogout}
              last
            />
          </SolidCard>
        </View>

        <View style={styles.footer}>
          <AppText variant="caption" color={colors.faint} align="center">
            ArchSchool · ساخته‌شده برای یک کلاس، نه یک فید بی‌پایان.
          </AppText>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Sheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="ویرایش پروفایل"
        subtitle="نام کاربری را ادمین تغییر می‌دهد"
        footer={
          <Button
            label="ذخیرهٔ تغییرات"
            icon="checkmark"
            onPress={() => void saveProfile()}
            loading={saving}
            disabled={uploadingAvatar}
          />
        }
      >
        <View style={styles.editAvatar}>
          <Avatar name={user?.username} uri={avatarUrl || user?.avatar_url} size="lg" ring />
          <Button
            label={uploadingAvatar ? "در حال بارگذاری…" : "تغییر تصویر"}
            icon="image-outline"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => void pickAvatar()}
          />
        </View>

        <Field
          label="بیوگرافی"
          value={bio}
          onChangeText={setBio}
          placeholder="یک جمله دربارهٔ خودت…"
          multiline
          maxLength={500}
        />

        {editError ? (
          <View style={styles.editError}>
            <Ionicons name="alert-circle" size={14} color={colors.red} />
            <AppText variant="caption" color={colors.red} style={{ flex: 1 }}>
              {editError}
            </AppText>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  hero: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  heroText: { alignItems: "center", gap: 3 },
  heroPills: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: "row-reverse",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  weekHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { paddingTop: spacing.xl },
  actionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  footer: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg },
  editAvatar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  editError: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: "rgba(242,104,107,0.3)",
  },
});
