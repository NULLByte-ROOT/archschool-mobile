import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchUserProfile, fetchUserStats, qk } from "@/api/client";
import type { Role } from "@/api/types";
import { AreaChart } from "@/components/charts";
import { AppText, Avatar } from "@/components/ui";
import { MonoLabel, PulseDot } from "@/components/webui";
import { dmRoom } from "@/lib/chat";
import { faDate, fmtNum, fmtPercent, lastSeenLabel, parseDue } from "@/lib/format";
import { canChat } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/**
 * The one profile sheet in the app.
 *
 * Every avatar / username tap — chat bubbles, chat list rows, assignment team
 * status, leaderboard, comments — opens this. It is deliberately the *same*
 * modal everywhere so a tap never lands somewhere unexpected.
 *
 * Layout mirrors `frontend/src/components/UserProfileModal.tsx`: cover sheen,
 * overlapping avatar + role badge, completion bar, streak/speed pair, strongest
 * & weakest subject, 7-day activity chart, bio, one primary action.
 *
 * Animation is a single 160 ms fade (theme rule: nothing bounces).
 */

export const ROLE_TONE: Record<
  Role,
  { label: string; color: string; background: string; border: string }
> = {
  owner: {
    label: "Owner",
    color: colors.warning,
    background: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.40)",
  },
  admin: {
    label: "Admin",
    color: colors.white,
    background: "rgba(255,255,255,0.10)",
    border: "rgba(255,255,255,0.25)",
  },
  friend: {
    label: "Friend",
    color: colors.success,
    background: colors.successSoft,
    border: colors.successLine,
  },
  member: {
    label: "Member",
    color: colors.textSoft,
    background: colors.white04,
    border: colors.white12,
  },
};

function formatSpeed(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} دقیقه`;
  return `${fmtNum(Math.round(hours * 10) / 10)} ساعت`;
}

function relativeAgo(value: string | null | undefined): string {
  const date = parseDue(value);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} روز پیش`;
  return faDate(date, "short");
}

function MiniCard({
  icon,
  label,
  value,
  hint,
  tone = colors.faint,
  background = colors.white03,
  border = colors.line,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  background?: string;
  border?: string;
}) {
  return (
    <View style={[styles.miniCard, { backgroundColor: background, borderColor: border }]}>
      <View style={styles.miniHead}>
        <Ionicons name={icon} size={12} color={tone} />
        <AppText color={colors.faint} style={styles.miniLabel} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText color={colors.text} style={styles.miniValue} numberOfLines={1} ltr={false}>
        {value}
      </AppText>
      {hint ? (
        <AppText color={colors.faint} style={styles.miniHint} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function UserProfileModal({
  userId,
  onClose,
}: {
  userId: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((state) => state.user);
  const open = userId !== null;

  const profileQuery = useQuery({
    queryKey: qk.user(userId ?? 0),
    queryFn: () => fetchUserProfile(userId as number),
    enabled: open,
  });
  const statsQuery = useQuery({
    queryKey: qk.userStats(userId ?? 0),
    queryFn: () => fetchUserStats(userId as number),
    enabled: open,
  });

  const profile = profileQuery.data ?? null;
  const stats = statsQuery.data ?? null;
  const loading = open && (profileQuery.isLoading || statsQuery.isLoading);
  const error = profileQuery.error ?? statsQuery.error;

  const role = (profile?.role ?? "member") as Role;
  const tone = ROLE_TONE[role] ?? ROLE_TONE.member;
  const isSelf = Boolean(profile && me && profile.id === me.id);
  const pct = Math.max(0, Math.min(100, stats?.completion_percentage ?? 0));
  const chart = (stats?.weekly_activity ?? []).map((day) => {
    const date = parseDue(day.date) ?? new Date(day.date);
    let label = "";
    try {
      label = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
        weekday: "short",
      }).format(date);
    } catch {
      label = "";
    }
    return { label, value: day.count };
  });

  const messagePeer = () => {
    if (!profile || !me) return;
    onClose();
    router.push({
      pathname: "/chat/[room]",
      params: { room: dmRoom(me.id, profile.id) },
    });
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(160)}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          <View style={styles.cover}>
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.16)",
                "rgba(255,255,255,0.04)",
                "rgba(0,0,0,0)",
              ]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="بستن"
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.textSoft} />
            </Pressable>
            {stats && stats.rank > 0 ? (
              <View style={styles.rankPill}>
                <Ionicons name="trophy" size={11} color={colors.warning} />
                <AppText color={colors.text} style={styles.rankText}>
                  رتبه {fmtNum(stats.rank)}
                </AppText>
              </View>
            ) : null}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.avatarRow}>
              <Avatar
                name={profile?.username ?? "?"}
                uri={profile?.avatar_url}
                size="xl"
                style={styles.avatar}
              />
              {profile ? (
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: tone.background, borderColor: tone.border },
                  ]}
                >
                  <Ionicons name="person-outline" size={11} color={tone.color} />
                  <AppText color={tone.color} style={styles.roleText}>
                    {tone.label}
                  </AppText>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} />
                <AppText color={colors.faint} style={styles.loadingText}>
                  در حال بارگذاری…
                </AppText>
              </View>
            ) : error || !profile || !stats ? (
              <AppText color={colors.red} align="center" style={styles.errorText}>
                {error instanceof Error ? error.message : "خطا در بارگذاری پروفایل"}
              </AppText>
            ) : (
              <>
                <AppText ltr style={styles.username} numberOfLines={1}>
                  {profile.username}
                </AppText>
                <View style={styles.metaRow}>
                  <PulseDot size={6} tone={colors.success} />
                  <AppText color={colors.faint} style={styles.metaText}>
                    {lastSeenLabel(profile.last_seen)}
                  </AppText>
                  <AppText color={colors.faint} style={styles.metaDot}>
                    ·
                  </AppText>
                  <Ionicons name="calendar-outline" size={11} color={colors.faint} />
                  <AppText color={colors.faint} style={styles.metaText}>
                    عضو از {faDate(profile.created_at, "short")}
                  </AppText>
                </View>

                {/* completion */}
                <View style={styles.completionCard}>
                  <View style={styles.completionHead}>
                    <View>
                      <MonoLabel>// COMPLETION</MonoLabel>
                      <AppText color={colors.faint} style={styles.completionMeta}>
                        {fmtNum(stats.completed_count)} از {fmtNum(stats.total_assignments)} تکلیف
                      </AppText>
                    </View>
                    <AppText ltr style={styles.completionValue}>
                      {fmtPercent(pct)}
                    </AppText>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                </View>

                <View style={styles.grid}>
                  <MiniCard
                    icon="flame"
                    label="استریک فعلی"
                    value={`${fmtNum(stats.current_streak)} روز`}
                    tone={colors.flame}
                    background={colors.flameSoft}
                    border={colors.flameLine}
                  />
                  <MiniCard
                    icon="trophy"
                    label="بهترین استریک"
                    value={`${fmtNum(stats.best_streak)} روز`}
                    tone={colors.warning}
                  />
                  <MiniCard
                    icon="speedometer-outline"
                    label="سرعت میانگین"
                    value={formatSpeed(stats.average_speed_hours)}
                  />
                  <MiniCard
                    icon="pulse-outline"
                    label="آخرین فعالیت"
                    value={
                      stats.completed_today
                        ? "امروز"
                        : relativeAgo(stats.last_completion_time)
                    }
                  />
                </View>

                <View style={styles.grid}>
                  <MiniCard
                    icon="trending-up-outline"
                    label="قوی‌ترین درس"
                    value={stats.strongest_subject ?? "هنوز مشخص نیست"}
                    tone={colors.success}
                    background={colors.successSoft}
                    border="rgba(52,211,153,0.20)"
                  />
                  <MiniCard
                    icon="trending-down-outline"
                    label="ضعیف‌ترین درس"
                    value={stats.weakest_subject ?? "هنوز مشخص نیست"}
                    tone={colors.red}
                    background={colors.redSoft}
                    border="rgba(248,113,113,0.20)"
                  />
                </View>

                <View style={styles.chartCard}>
                  <View style={styles.chartHead}>
                    <MonoLabel>// LAST 7 DAYS</MonoLabel>
                    <AppText color={colors.faint} style={styles.chartMeta}>
                      {fmtNum(chart.reduce((sum, point) => sum + point.value, 0))} تکمیل
                    </AppText>
                  </View>
                  <View style={styles.chartBody}>
                    <AreaChart
                      data={chart.length ? chart : [{ label: "", value: 0 }]}
                      height={120}
                      unit="تکمیل"
                      dotColors={chart.map((point) =>
                        point.value > 0 ? "#34d399" : "#f87171"
                      )}
                    />
                  </View>
                  <View style={styles.axisRow}>
                    {chart.map((point, index) => (
                      <View key={`${point.label}-${index}`} style={styles.axisCol}>
                        <View
                          style={[
                            styles.dayDot,
                            {
                              backgroundColor:
                                point.value > 0 ? "#34d399" : "#f87171",
                            },
                          ]}
                        />
                        <AppText
                          align="center"
                          color={colors.faint}
                          style={styles.axisText}
                        >
                          {point.label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.bio}>
                  <AppText color={colors.textSoft} style={styles.bioText}>
                    {profile.bio?.trim() || "این کاربر هنوز بیوگرافی ننوشته."}
                  </AppText>
                </View>

                {isSelf ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push("/(tabs)/profile");
                    }}
                    style={styles.actionGhost}
                  >
                    <Ionicons name="settings-outline" size={14} color={colors.text} />
                    <AppText color={colors.text} style={styles.actionText}>
                      ویرایش پروفایل من
                    </AppText>
                  </Pressable>
                ) : !canChat(me) ? (
                  <View style={styles.lockRow}>
                    <Ionicons name="lock-closed" size={12} color={colors.faint} />
                    <AppText color={colors.faint} style={styles.lockText}>
                      برای دسترسی به گفتگو، از ادمین اجازه بگیرید.
                    </AppText>
                  </View>
                ) : (
                  <Pressable onPress={messagePeer} style={styles.actionPrimary}>
                    <Ionicons name="chatbubble-ellipses" size={14} color={colors.onAccent} />
                    <AppText color={colors.onAccent} style={styles.actionText}>
                      ارسال پیام
                    </AppText>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.white12,
    backgroundColor: "#0b0b10",
    overflow: "hidden",
  },
  cover: {
    height: 104,
    overflow: "hidden",
    justifyContent: "flex-start",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: colors.white12,
  },
  rankPill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: colors.white18,
  },
  rankText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
  },
  body: { marginTop: -46 },
  bodyContent: {
    paddingHorizontal: 18,
    paddingBottom: spacing.md,
    gap: 10,
  },
  avatarRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  avatar: {
    borderWidth: 4,
    borderColor: "#0b0b10",
  },
  roleBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: 4,
  },
  roleText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.4,
  },
  username: {
    fontFamily: fonts.black,
    fontSize: 21,
    lineHeight: 29,
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
  },
  metaText: { fontSize: 11, lineHeight: 17 },
  metaDot: { fontSize: 11, lineHeight: 17, opacity: 0.5 },
  completionCard: {
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: colors.white03,
    padding: 13,
    gap: 9,
  },
  completionHead: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  completionMeta: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  completionValue: {
    fontFamily: fonts.black,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white06,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  grid: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  miniCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.white03,
    borderColor: colors.line,
    padding: 11,
    gap: 3,
    minWidth: 0,
  },
  miniHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  miniLabel: { fontSize: 10, lineHeight: 15 },
  miniValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 20,
  },
  miniHint: { fontSize: 9.5, lineHeight: 14 },
  chartCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    padding: 12,
    gap: 6,
  },
  chartHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartMeta: { fontSize: 10, lineHeight: 15 },
  chartBody: { direction: "ltr" },
  axisRow: { flexDirection: "row-reverse" },
  axisCol: { flex: 1, alignItems: "center", gap: 3 },
  dayDot: { width: 5, height: 5, borderRadius: 3 },
  axisText: { fontSize: 9, lineHeight: 13 },
  bio: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    padding: 12,
  },
  bioText: { fontSize: 12, lineHeight: 21 },
  actionPrimary: {
    marginTop: 2,
    height: 48,
    borderRadius: radius.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.white,
  },
  actionGhost: {
    marginTop: 2,
    height: 48,
    borderRadius: radius.md,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white04,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    lineHeight: 18,
  },
  lockRow: {
    marginTop: 2,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
  },
  lockText: { fontSize: 11, lineHeight: 17, flexShrink: 1 },
  loadingBox: {
    paddingVertical: 44,
    alignItems: "center",
    gap: 10,
  },
  loadingText: { fontSize: 11, lineHeight: 17 },
  errorText: { paddingVertical: 32, fontSize: 12, lineHeight: 19 },
});
