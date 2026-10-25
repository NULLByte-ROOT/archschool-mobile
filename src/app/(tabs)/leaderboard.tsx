import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { fetchLeaderboard, fetchUserStats, qk } from "@/api/client";
import type { LeaderboardEntry } from "@/api/types";
import {
  EmptyState,
  GlassCard,
  SectionTitle,
  SkeletonRows,
  SolidCard,
  StatTile,
} from "@/components/cards";
import { Header } from "@/components/Header";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Pill } from "@/components/ui";
import { WeekBars } from "@/components/WeekBars";
import { faDate, fmtNum, fmtPercent, latinDigits } from "@/lib/format";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

function medalColor(rank: number): string {
  if (rank === 1) return colors.amber;
  if (rank === 2) return "#C9D6E6";
  if (rank === 3) return "#D08A5A";
  return colors.muted;
}

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

          <View style={styles.statRow}>
            <StatTile
              label="درصد تحویل"
              value={fmtPercent(entry.completion_percentage)}
              icon="analytics-outline"
            />
            <StatTile
              label="زنجیرهٔ فعلی"
              value={`${fmtNum(entry.current_streak)} روز`}
              icon="flame-outline"
              tone={colors.red}
            />
          </View>
          <View style={styles.statRow}>
            <StatTile
              label="بهترین زنجیره"
              value={`${fmtNum(entry.best_streak)} روز`}
              icon="trophy-outline"
              tone={colors.teal}
            />
            <StatTile
              label="تحویل‌ها"
              value={`${fmtNum(entry.completed_count)} / ${fmtNum(entry.total_assignments)}`}
              icon="checkmark-done-outline"
              tone={colors.blue}
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
                <Ionicons name="trending-up-outline" size={15} color={colors.teal} />
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
                <Ionicons name="trending-down-outline" size={15} color={colors.red} />
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
                {fmtNum(
                  entry.weekly_activity.reduce((sum, day) => sum + day.count, 0)
                )}{" "}
                تحویل
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

export default function LeaderboardScreen() {
  const user = useAuthStore((state) => state.user);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  const selectedEntry =
    stats.data ?? entries.find((entry) => entry.user.id === selectedId);

  return (
    <Screen edges={["top"]}>
      <Header
        title="لیدر بورد"
        subtitle={
          entries.length ? `${fmtNum(entries.length)} عضو در رقابت` : "در حال بارگذاری"
        }
      />

      {query.isLoading ? (
        <View style={{ paddingHorizontal: screenGutter }}>
          <SkeletonRows count={5} height={72} />
        </View>
      ) : query.isError && !query.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="جدول بارگذاری نشد"
          hint="اتصال اینترنت را بررسی کنید."
          actionLabel="تلاش دوباره"
          onAction={() => void query.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
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
          {mine ? (
            <Animated.View entering={FadeInDown.duration(420)}>
              <GlassCard glow contentStyle={styles.mineCard}>
                <View style={styles.mineTop}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <AppText variant="label" color={colors.muted}>
                      جایگاه تو
                    </AppText>
                    <View style={styles.mineRank}>
                      <AppText variant="number" color={colors.amber} ltr>
                        {fmtNum(mine.rank)}
                      </AppText>
                      <AppText variant="caption" color={colors.muted} style={{ paddingBottom: 7 }}>
                        از {fmtNum(entries.length)}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-start", gap: 2 }}>
                    <AppText variant="numberSm" color={colors.text} ltr>
                      {fmtPercent(mine.completion_percentage)}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {fmtNum(mine.completed_count)} از {fmtNum(mine.total_assignments)}
                    </AppText>
                  </View>
                </View>
                <ProgressBar value={mine.completion_percentage} height={8} />
                <View style={styles.mineFoot}>
                  <View style={styles.rowTight}>
                    <Ionicons name="flame" size={13} color={colors.red} />
                    <AppText variant="caption" color={colors.muted}>
                      {fmtNum(mine.current_streak)} روز زنجیره
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.faint}>
                    بهترین: {fmtNum(mine.best_streak)} روز
                  </AppText>
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}

          <View style={styles.section}>
            <SectionTitle title="رتبه‌بندی کلاس" hint="بر اساس درصد تحویل" />
            <SolidCard style={{ paddingHorizontal: spacing.md }}>
              {entries.map((entry, index) => {
                const isMe = entry.user.id === user?.id;
                const tone = medalColor(entry.rank);
                return (
                  <View key={entry.user.id}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      onPress={() => setSelectedId(entry.user.id)}
                      style={({ pressed }) => [
                        styles.row,
                        isMe && styles.rowMe,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={styles.rank}>
                        {entry.rank <= 3 ? (
                          <Ionicons name="medal" size={18} color={tone} />
                        ) : (
                          <AppText
                            variant="caption"
                            color={colors.muted}
                            ltr
                            style={{ fontFamily: fonts.medium }}
                          >
                            {fmtNum(entry.rank)}
                          </AppText>
                        )}
                      </View>

                      <Avatar
                        name={entry.user.username}
                        uri={entry.user.avatar_url}
                        size="sm"
                        ring={isMe}
                      />

                      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                        <View style={styles.rowBetween}>
                          <View style={styles.nameRow}>
                            <AppText
                              variant="label"
                              numberOfLines={1}
                              style={{ fontFamily: fonts.semibold, flexShrink: 1 }}
                            >
                              {entry.user.username}
                            </AppText>
                            {isMe ? <Pill label="تو" tone="amber" /> : null}
                          </View>
                          <AppText
                            variant="label"
                            color={tone}
                            ltr
                            style={{ fontFamily: fonts.semibold }}
                          >
                            {fmtPercent(entry.completion_percentage)}
                          </AppText>
                        </View>

                        <ProgressBar
                          value={entry.completion_percentage}
                          color={tone}
                          height={5}
                          delay={Math.min(index * 25, 400)}
                        />

                        <View style={styles.rowBetween}>
                          <AppText variant="caption" color={colors.faint} ltr>
                            {fmtNum(entry.completed_count)}/{fmtNum(entry.total_assignments)}
                          </AppText>
                          <View style={styles.rowTight}>
                            <Ionicons
                              name="flame-outline"
                              size={11}
                              color={entry.current_streak > 0 ? colors.red : colors.faint}
                            />
                            <AppText variant="caption" color={colors.faint} ltr>
                              {fmtNum(entry.current_streak)}
                            </AppText>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              })}

              {entries.length === 0 ? (
                <EmptyState
                  compact
                  icon="podium-outline"
                  title="هنوز کسی رتبه نگرفته"
                  hint="با تحویل اولین تکلیف، جدول شروع می‌شود."
                />
              ) : null}
            </SolidCard>
          </View>

          <View style={styles.legend}>
            <Ionicons name="information-circle-outline" size={13} color={colors.faint} />
            <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
              رتبه بر اساس درصد تحویل است؛ در درصد برابر، زمان آخرین تحویل تعیین‌کننده است.
            </AppText>
          </View>
        </ScrollView>
      )}

      <ProfileStatsSheet
        visible={selectedId !== null}
        onClose={() => setSelectedId(null)}
        entry={selectedEntry}
        loading={stats.isLoading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingBottom: 120 },
  section: { paddingTop: spacing.xl },
  mineCard: { padding: spacing.lg, gap: spacing.sm },
  mineTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  mineRank: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 5,
  },
  mineFoot: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  rowMe: { backgroundColor: "rgba(242,180,85,0.07)" },
  rank: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  rowTight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: 1,
  },
  legend: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 5,
    marginTop: spacing.lg,
    paddingHorizontal: 4,
  },
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
  statRow: {
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
