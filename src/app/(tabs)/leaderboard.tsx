import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
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

import { fetchLeaderboard, qk } from "@/api/client";
import type { LeaderboardEntry, Role } from "@/api/types";
import { EmptyState } from "@/components/cards";
import { LeaderboardItemSkeleton } from "@/components/Skeleton";
import { Screen } from "@/components/Screen";
import { AppText, Avatar } from "@/components/ui";
import { UserProfileModal } from "@/components/UserProfileModal";
import { Corners, Kicker, MonoLabel, Panel, PulseDot } from "@/components/webui";
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

function useBiWeeklyCountdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      // Iran time is UTC + 3:30 (210 minutes)
      const iranTime = new Date(now.getTime() + (3.5 * 60 + now.getTimezoneOffset()) * 60000);

      // Reference epoch: Wednesday Nov 4 2026 22:00 Iran time
      const epoch = new Date(2026, 10, 4, 22, 0, 0);
      const diffMs = iranTime.getTime() - epoch.getTime();
      const seasonMs = 14 * 24 * 3600 * 1000;

      const currentSeason = Math.floor(Math.max(0, diffMs) / seasonMs) + 1;
      const nextResetMs = epoch.getTime() + currentSeason * seasonMs;

      const remMs = Math.max(0, nextResetMs - iranTime.getTime());
      const totalSec = Math.floor(remMs / 1000);

      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

function SeasonCountdownCard() {
  const countdown = useBiWeeklyCountdown();

  return (
    <Panel corners contentStyle={styles.countdownCard} style={{ marginBottom: 14 }}>
      <View style={styles.countdownHead}>
        <View style={styles.countdownTitleRow}>
          <PulseDot size={6} tone={colors.flame} />
          <AppText style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>
            سیزن دوره‌ای لیدربورد کلاس
          </AppText>
        </View>
        <MonoLabel tone={colors.flameText}>// BI-WEEKLY RESET</MonoLabel>
      </View>

      <AppText color={colors.textSoft} style={{ fontSize: 11, lineHeight: 17, marginVertical: 6 }}>
        رنکینگ هر دو هفته چهارشنبه ساعت ۲۲:۰۰ ریست می‌شود و امتیازات دوره جدید از صفر آغاز می‌گردد:
      </AppText>

      <View style={styles.timerRow}>
        <View style={styles.timeUnit}>
          <AppText style={styles.timeVal}>{fmtNum(countdown.days)}</AppText>
          <AppText style={styles.timeLabel}>روز</AppText>
        </View>
        <AppText style={styles.timeColon}>:</AppText>
        <View style={styles.timeUnit}>
          <AppText style={styles.timeVal}>{String(countdown.hours).padStart(2, "0")}</AppText>
          <AppText style={styles.timeLabel}>ساعت</AppText>
        </View>
        <AppText style={styles.timeColon}>:</AppText>
        <View style={styles.timeUnit}>
          <AppText style={styles.timeVal}>{String(countdown.minutes).padStart(2, "0")}</AppText>
          <AppText style={styles.timeLabel}>دقیقه</AppText>
        </View>
        <AppText style={styles.timeColon}>:</AppText>
        <View style={styles.timeUnit}>
          <AppText style={[styles.timeVal, { color: colors.flame }]}>
            {String(countdown.seconds).padStart(2, "0")}
          </AppText>
          <AppText style={styles.timeLabel}>ثانیه</AppText>
        </View>
      </View>
    </Panel>
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
  const queryClient = useQueryClient();
  const [profileId, setProfileId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
    }, [queryClient])
  );

  const query = useQuery({
    queryKey: qk.leaderboard,
    queryFn: fetchLeaderboard,
  });

  const entries = query.data ?? [];
  const mine = entries.find((entry) => entry.user.id === user?.id);
  const teamRecord = entries.reduce((best, entry) => Math.max(best, entry.best_streak), 0);

  return (
    <Screen edges={["top"]} underStatusBar>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xs,
            paddingBottom: tabBarReserve + insets.bottom + 28,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            progressViewOffset={insets.top}
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

        {/* Season Countdown */}
        <Animated.View entering={FadeInDown.duration(180).delay(10)}>
          <SeasonCountdownCard />
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
          <View style={{ gap: 8, marginTop: 4 }}>
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <LeaderboardItemSkeleton key={idx} />
            ))}
          </View>
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
                  onOpen={() => setProfileId(entry.user.id)}
                  onProfile={() => setProfileId(entry.user.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

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
  countdownCard: {
    padding: 14,
    backgroundColor: "rgba(245, 158, 11, 0.04)",
  },
  countdownHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  countdownTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  timerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timeUnit: {
    alignItems: "center",
    minWidth: 44,
  },
  timeVal: {
    fontFamily: fonts.black,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  timeLabel: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.faint,
    marginTop: 1,
  },
  timeColon: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: colors.faint,
    marginBottom: 14,
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
