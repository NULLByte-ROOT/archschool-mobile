import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchLeaderboard, fetchUserStats, qk } from "@/api/client";
import type { LeaderboardEntry, Role } from "@/api/types";
import { EmptyState, SkeletonRows, SolidCard, StatTile } from "@/components/cards";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Pill } from "@/components/ui";
import { UserProfileModal } from "@/components/UserProfileModal";
import { Corners, Kicker, MonoLabel, Panel } from "@/components/webui";
import { WeekBars } from "@/components/WeekBars";
import { faDate, fmtNum, fmtPercent, latinDigits } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

/* ------------------------------------------------------------------ */
/* rank / role styling — copied from the web LeaderboardPage           */
/* ------------------------------------------------------------------ */

interface RankStyle {
  border: string;
  background: string;
  medal: string;
  medalText: string;
  bar: string;
  percent: string;
}

const RANK_STYLES: RankStyle[] = [
  {
    border: "rgba(251,191,36,0.45)",
    background: "rgba(251,191,36,0.07)",
    medal: "#FBBF24",
    medalText: "#000000",
    bar: "#FBBF24",
    percent: "#FBBF24",
  },
  {
    border: "rgba(255,255,255,0.30)",
    background: "rgba(255,255,255,0.055)",
    medal: "#D4D4D8",
    medalText: "#000000",
    bar: "#D4D4D8",
    percent: "#FFFFFF",
  },
  {
    border: "rgba(201,132,85,0.45)",
    background: "rgba(201,132,85,0.07)",
    medal: "#C98455",
    medalText: "#000000",
    bar: "#C98455",
    percent: "#E0A479",
  },
];

const ROLE_BADGE: Record<Role, { label: string; border: string; bg: string; text: string }> = {
  owner: {
    label: "OWNER",
    border: "rgba(255,255,255,0.28)",
    bg: "rgba(255,255,255,0.10)",
    text: "#FFFFFF",
  },
  admin: {
    label: "ADMIN",
    border: "rgba(255,255,255,0.25)",
    bg: "rgba(255,255,255,0.10)",
    text: "#FFFFFF",
  },
  friend: {
    label: "FRIEND",
    border: "rgba(52,211,153,0.35)",
    bg: "rgba(52,211,153,0.10)",
    text: "#34D399",
  },
  member: {
    label: "MEMBER",
    border: "rgba(255,255,255,0.12)",
    bg: "rgba(255,255,255,0.04)",
    text: "#7C7C86",
  },
};

/* ------------------------------------------------------------------ */
/* profile sheet (native extra, unchanged behaviour)                   */
/* ------------------------------------------------------------------ */

function speedLabel(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${latinDigits(Math.max(1, Math.round(hours * 60)).toString())} دقیقه`;
  return `${latinDigits(hours.toFixed(1))} ساعت`;
}

function ProfileStatsSheet({
  entry,
  loading,
  visible,
  onClose,
}: {
  entry: LeaderboardEntry | undefined;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={entry?.user.username ?? "آمار عضو"}
      subtitle={entry ? `رتبهٔ ${fmtNum(entry.rank)} از تیم` : undefined}
    >
      {loading && !entry ? (
        <SkeletonRows count={3} height={70} />
      ) : !entry ? (
        <EmptyState compact icon="person-outline" title="آماری پیدا نشد" />
      ) : (
        <>
          <View style={styles.sheetHead}>
            <Avatar name={entry.user.username} uri={entry.user.avatar_url} size="lg" ring />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="subtitle">{entry.user.username}</AppText>
              <View style={styles.sheetPills}>
                <Pill label={`رتبه ${fmtNum(entry.rank)}`} tone="amber" icon="podium-outline" />
                <Pill
                  label={entry.completed_today ? "امروز ثبت شد" : "امروز ثبت نشده"}
                  tone={entry.completed_today ? "teal" : "red"}
                />
              </View>
            </View>
          </View>

          <View style={styles.sheetStatRow}>
            <StatTile
              label="درصد تحویل"
              value={fmtPercent(entry.completion_percentage)}
              icon="analytics-outline"
            />
            <StatTile
              label="زنجیرهٔ فعلی"
              value={`${fmtNum(entry.current_streak)} روز`}
              icon="flame-outline"
              tone={colors.flame}
            />
          </View>
          <View style={styles.sheetStatRow}>
            <StatTile
              label="بهترین زنجیره"
              value={`${fmtNum(entry.best_streak)} روز`}
              icon="trophy-outline"
              tone={colors.amber}
            />
            <StatTile
              label="تحویل‌ها"
              value={`${fmtNum(entry.completed_count)} / ${fmtNum(entry.total_assignments)}`}
              icon="checkmark-done-outline"
              tone={colors.success}
            />
          </View>

          <SolidCard style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={styles.sheetLine}>
              <View style={styles.sheetLineRight}>
                <Ionicons name="speedometer-outline" size={15} color={colors.amber} />
                <AppText variant="caption" color={colors.muted}>
                  میانگین سرعت تحویل
                </AppText>
              </View>
              <AppText variant="label" style={{ fontFamily: fonts.semibold }}>
                {speedLabel(entry.average_speed_hours)}
              </AppText>
            </View>
            <View style={styles.sheetLine}>
              <View style={styles.sheetLineRight}>
                <Ionicons name="trending-up-outline" size={15} color={colors.success} />
                <AppText variant="caption" color={colors.muted}>
                  قوی‌ترین درس
                </AppText>
              </View>
              <AppText variant="label" numberOfLines={1} style={{ maxWidth: 160 }}>
                {entry.strongest_subject ?? "—"}
              </AppText>
            </View>
            <View style={styles.sheetLine}>
              <View style={styles.sheetLineRight}>
                <Ionicons name="trending-down-outline" size={15} color={colors.danger} />
                <AppText variant="caption" color={colors.muted}>
                  ضعیف‌ترین درس
                </AppText>
              </View>
              <AppText variant="label" numberOfLines={1} style={{ maxWidth: 160 }}>
                {entry.weakest_subject ?? "—"}
              </AppText>
            </View>
            <View style={styles.sheetLine}>
              <View style={styles.sheetLineRight}>
                <Ionicons name="time-outline" size={15} color={colors.blue} />
                <AppText variant="caption" color={colors.muted}>
                  آخرین تحویل
                </AppText>
              </View>
              <AppText variant="label" numberOfLines={1} style={{ maxWidth: 180 }}>
                {entry.last_completion_time
                  ? faDate(entry.last_completion_time, "weekdayTime")
                  : "—"}
              </AppText>
            </View>
          </SolidCard>

          <SolidCard style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={styles.sheetLine}>
              <AppText variant="label" color={colors.muted}>
                هفتهٔ اخیر
              </AppText>
              <AppText variant="caption" color={colors.faint} ltr>
                {fmtNum(entry.weekly_activity.reduce((sum, day) => sum + day.count, 0))} تحویل
              </AppText>
            </View>
            <View style={{ alignSelf: "center" }}>
              <WeekBars data={entry.weekly_activity} maxBarHeight={44} />
            </View>
          </SolidCard>
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* summary card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone,
  style,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  style?: object;
}) {
  return (
    <Panel corners contentStyle={styles.summaryPad} style={style}>
      <View style={styles.summaryHead}>
        <Ionicons name={icon} size={17} color={tone ?? colors.faint} />
        <MonoLabel style={{ flexShrink: 1 }}>{label}</MonoLabel>
      </View>
      <AppText
        numberOfLines={1}
        style={{ fontFamily: fonts.black, fontSize: 18, lineHeight: 25 }}
      >
        {value}
      </AppText>
      {hint ? (
        <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 10, lineHeight: 15, marginTop: 2 }}>
          {hint}
        </AppText>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* leaderboard row                                                    */
/* ------------------------------------------------------------------ */

function LeaderboardRow({
  row,
  index,
  isMe,
  onOpen,
  onProfile,
}: {
  row: LeaderboardEntry;
  index: number;
  isMe: boolean;
  onOpen: () => void;
  onProfile: () => void;
}) {
  const style = RANK_STYLES[index];
  const role = (row.user.role ?? "member") as Role;
  const badge = ROLE_BADGE[role] ?? ROLE_BADGE.member;
  const pct = Math.max(0, Math.min(100, row.completion_percentage));

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: style?.border ?? "rgba(255,255,255,0.08)",
          backgroundColor: style?.background ?? "rgba(255,255,255,0.02)",
        },
        isMe && styles.rowMe,
        pressed && { opacity: 0.9 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${row.user.username} — ${fmtPercent(pct)} تکمیل`}
    >
      <Corners />

      <View style={styles.rowMain}>
        <View
          style={[
            styles.medal,
            style
              ? { backgroundColor: style.medal, borderColor: style.medal }
              : { borderColor: colors.white10, backgroundColor: colors.white04 },
          ]}
        >
          {row.rank === 1 ? (
            <Ionicons name="trophy" size={16} color={style?.medalText ?? colors.faint} />
          ) : row.rank <= 3 ? (
            <Ionicons name="medal" size={16} color={style?.medalText ?? colors.faint} />
          ) : (
            <AppText
              ltr
              color={colors.faint}
              style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 }}
            >
              {fmtNum(row.rank)}
            </AppText>
          )}
        </View>

        <Pressable
          onPress={onProfile}
          hitSlop={6}
          accessibilityLabel={`پروفایل ${row.user.username}`}
        >
          <Avatar name={row.user.username} uri={row.user.avatar_url} size="md" ring={isMe} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowTitle}>
            <AppText
              ltr
              numberOfLines={1}
              onPress={onProfile}
              style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20, flexShrink: 1 }}
            >
              {row.user.username}
            </AppText>

            <View
              style={[
                styles.roleBadge,
                { borderColor: badge.border, backgroundColor: badge.bg },
              ]}
            >
              <AppText
                ltr
                color={badge.text}
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 8,
                  lineHeight: 11,
                  letterSpacing: 1.1,
                }}
              >
                {badge.label}
              </AppText>
            </View>

            {isMe ? (
              <View style={styles.meBadge}>
                <AppText
                  color={colors.white}
                  style={{ fontFamily: fonts.semibold, fontSize: 9, lineHeight: 13 }}
                >
                  تو
                </AppText>
              </View>
            ) : null}

            {row.current_streak > 0 ? (
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={11} color={colors.flame} />
                <AppText
                  ltr
                  color={colors.flameText}
                  style={{ fontFamily: fonts.black, fontSize: 10.5, lineHeight: 14 }}
                >
                  {fmtNum(row.current_streak)} روز
                </AppText>
              </View>
            ) : (
              <View style={styles.noStreak}>
                <AppText color={colors.faint} style={{ fontSize: 9, lineHeight: 13 }}>
                  بدون استریک
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.rowProgress}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor: style?.bar ?? "rgba(255,255,255,0.40)",
                  },
                ]}
              />
            </View>
            <AppText
              ltr
              color={colors.faint}
              style={{ fontSize: 9, lineHeight: 13, fontVariant: ["tabular-nums"] }}
            >
              {fmtNum(row.completed_count)} از {fmtNum(row.total_assignments)}
            </AppText>
          </View>
        </View>

        <View style={{ alignItems: "center", flexShrink: 0 }}>
          <AppText
            ltr
            style={{
              fontFamily: fonts.black,
              fontSize: 18,
              lineHeight: 25,
              fontVariant: ["tabular-nums"],
              color: style?.percent ?? colors.white,
            }}
          >
            {fmtPercent(pct, 1)}
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 9, lineHeight: 13 }}>
            تکمیل
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* screen                                                             */
/* ------------------------------------------------------------------ */

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: qk.leaderboard,
    queryFn: fetchLeaderboard,
  });

  const stats = useQuery({
    queryKey: qk.userStats(selectedId ?? 0),
    queryFn: () => fetchUserStats(selectedId ?? 0),
    enabled: selectedId !== null,
    staleTime: 30000,
  });

  const entries = query.data ?? [];
  const mine = entries.find((entry) => entry.user.id === user?.id);
  const teamRecord = entries.reduce((best, entry) => Math.max(best, entry.best_streak), 0);
  const selectedEntry = stats.data ?? entries.find((entry) => entry.user.id === selectedId);

  return (
    <Screen edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(180)} style={{ marginBottom: 20 }}>
          <Kicker text="leaderboard" dot style={{ marginBottom: 10 }} />
          <View style={styles.headerRow}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <AppText style={{ fontFamily: fonts.black, fontSize: 24, lineHeight: 33, letterSpacing: -0.4 }}>
                لیدر بورد
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
                رتبه‌بندی بر اساس درصد تکمیل تکالیف — نه امتیاز
              </AppText>
            </View>

            <Pressable
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                void query.refetch();
              }}
              disabled={query.isFetching}
              style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="بروزرسانی"
            >
              <Ionicons name="refresh" size={14} color={colors.textSoft} />
              <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
                بروزرسانی
              </AppText>
            </Pressable>
          </View>
        </Animated.View>

        {/* summary */}
        <Animated.View entering={FadeInDown.duration(180).delay(20)} style={styles.summaryGrid}>
          <SummaryCard
            icon="trophy"
            label="نفر اول"
            tone={colors.amber}
            value={entries[0]?.user.username ?? "—"}
            hint={entries[0] ? `${fmtPercent(entries[0].completion_percentage)} تکمیل` : undefined}
            style={styles.summaryHalf}
          />
          <SummaryCard
            icon="flame"
            label="رکورد استریک تیم"
            tone={colors.flame}
            value={`${fmtNum(teamRecord)} روز`}
            hint="بالاترین استریک بین همهٔ اعضا"
            style={styles.summaryHalf}
          />
          <SummaryCard
            icon="sparkles"
            label="رتبه تو"
            tone={colors.textSoft}
            value={mine ? `#${fmtNum(mine.rank)}` : "—"}
            hint={mine ? `${fmtPercent(mine.completion_percentage)} تکمیل` : undefined}
            style={{ width: "100%" }}
          />
        </Animated.View>

        {/* ranking rule */}
        <Animated.View entering={FadeInDown.duration(180).delay(40)} style={styles.rule}>
          <View style={styles.ruleIcon}>
            <Ionicons name="trophy" size={16} color={colors.amber} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 19 }}>
              رتبه‌بندی فقط با درصد تکمیل
            </AppText>
            <AppText color={colors.faint} style={{ fontSize: 11, lineHeight: 20, marginTop: 2 }}>
              هرکس درصد بیشتری از تکالیف را انجام داده باشد بالاتر است؛ در صورت تساوی، کسی که
              زودتر به آن درصد رسیده رتبهٔ بالاتر می‌گیرد.
            </AppText>
          </View>
        </Animated.View>

        {/* table */}
        {query.isLoading && entries.length === 0 ? (
          <Panel corners contentStyle={styles.loadingBox} style={{ marginTop: 4 }}>
            <ActivityIndicator color={colors.textSoft} />
            <AppText color={colors.faint} style={{ fontSize: 13 }}>
              در حال بارگذاری…
            </AppText>
          </Panel>
        ) : query.isError && entries.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              بارگذاری ناموفق بود
            </AppText>
            <AppText align="center" color={colors.faint} style={{ fontSize: 11 }}>
              اتصال اینترنت را بررسی کنید.
            </AppText>
            <Pressable
              onPress={() => void query.refetch()}
              style={styles.retry}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={14} color={colors.black} />
              <AppText color={colors.black} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                تلاش دوباره
              </AppText>
            </Pressable>
          </Panel>
        ) : entries.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <Ionicons name="trophy-outline" size={28} color={colors.faint} />
            <AppText color={colors.faint} style={{ fontSize: 14 }}>
              هنوز آماری برای نمایش نیست.
            </AppText>
          </Panel>
        ) : (
          <View style={{ gap: 10 }}>
            {entries.map((entry, index) => (
              <Animated.View
                key={entry.user.id}
                entering={FadeInDown.duration(180).delay(Math.min(index * 25, 220))}
              >
                <LeaderboardRow
                  row={entry}
                  index={index}
                  isMe={entry.user.id === user?.id}
                  onOpen={() => setSelectedId(entry.user.id)}
                  onProfile={() => setProfileId(entry.user.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <ProfileStatsSheet
        visible={selectedId !== null}
        onClose={() => setSelectedId(null)}
        entry={selectedEntry}
        loading={stats.isLoading}
      />

      <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
  },

  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  refreshButton: {
    minHeight: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },

  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  summaryHalf: { flexBasis: "47%", flexGrow: 1 },
  summaryPad: { padding: 16 },
  summaryHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  rule: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },

  row: {
    position: "relative",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  rowMe: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
  },
  rowMain: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  medal: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  roleBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  streakPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.40)",
    backgroundColor: "rgba(249,115,22,0.14)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  noStreak: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowProgress: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  fill: { height: "100%", borderRadius: 3 },

  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  retry: {
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.white,
    marginTop: 4,
  },

  /* profile sheet */
  sheetHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  sheetPills: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  sheetStatRow: {
    flexDirection: "row-reverse",
    gap: spacing.xs,
  },
  sheetLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sheetLineRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
});
