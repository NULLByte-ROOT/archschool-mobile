import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  fetchAssignments,
  fetchChatOverview,
  fetchOverview,
  fetchTeam,
  qk,
} from "@/api/client";
import type { Assignment, LeaderboardEntry, Message } from "@/api/types";
import { AppText, Avatar, Badge, Divider, type IconName } from "@/components/ui";
import {
  EmptyState,
  GlassCard,
  SectionTitle,
  SkeletonRows,
  SolidCard,
  StatTile,
} from "@/components/cards";
import { Screen } from "@/components/Screen";
import { WeekBars } from "@/components/WeekBars";
import { useNow } from "@/hooks/useNow";
import { dmRoom } from "@/lib/chat";
import {
  dueColor,
  dueTone,
  faDate,
  fmtNum,
  fmtPercent,
  formatDue,
  greeting,
  parseDue,
  relativeDue,
  todayLabel,
} from "@/lib/format";
import { canChat } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

function RiskDot({ active }: { active: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = active
      ? withRepeat(
          withSequence(
            withTiming(0.25, { duration: 620 }),
            withTiming(1, { duration: 620 })
          ),
          -1,
          true
        )
      : withTiming(1, { duration: 180 });
  }, [active, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.riskDot,
        { backgroundColor: active ? colors.red : colors.teal },
        animatedStyle,
      ]}
    />
  );
}

function RankRow({
  entry,
  onPress,
}: {
  entry: LeaderboardEntry;
  onPress: () => void;
}) {
  const tone =
    entry.rank === 1 ? colors.amber : entry.rank === 2 ? "#C9D6E6" : colors.blue;

  return (
    <Pressable onPress={onPress} style={styles.rankRow}>
      <AppText
        variant="numberSm"
        color={tone}
        style={{ width: 24, fontSize: 15 }}
        align="center"
        ltr
      >
        {entry.rank}
      </AppText>
      <Avatar name={entry.user.username} uri={entry.user.avatar_url} size="sm" />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.rankTop}>
          <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {entry.user.username}
          </AppText>
          <AppText variant="caption" color={tone} ltr style={{ fontFamily: fonts.semibold }}>
            {fmtPercent(entry.completion_percentage)}
          </AppText>
        </View>
        <View style={styles.rankTrack}>
          <View
            style={[
              styles.rankFill,
              {
                width: `${Math.max(2, Math.min(100, entry.completion_percentage))}%`,
                backgroundColor: tone,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function DeadlineRow({
  assignment,
  now,
  onPress,
}: {
  assignment: Assignment;
  now: number;
  onPress: () => void;
}) {
  const tone = dueTone(assignment.due_date, now);
  const overdue = parseDue(assignment.due_date)?.getTime();
  const late = Boolean(overdue && overdue < now);

  return (
    <Pressable onPress={onPress} style={styles.deadlineRow}>
      <View
        style={[
          styles.deadlineIcon,
          {
            backgroundColor: late ? colors.redSoft : colors.amberSoft,
            borderColor: late ? "rgba(242,104,107,0.3)" : colors.amberLine,
          },
        ]}
      >
        <Ionicons
          name={late ? "alert-circle-outline" : "time-outline"}
          size={16}
          color={late ? colors.red : colors.amber}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
          {assignment.title}
        </AppText>
        <AppText variant="caption" color={colors.faint} numberOfLines={1}>
          {assignment.course || "بدون درس"} · {formatDue(assignment.due_date)}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color={late ? colors.red : dueColor(tone)}
        style={{ fontFamily: fonts.medium, maxWidth: 96 }}
        align="left"
      >
        {relativeDue(assignment.due_date, now)}
      </AppText>
    </Pressable>
  );
}

function ChatPreview({
  title,
  message,
  fallbackIcon,
  onPress,
  badge = 0,
}: {
  title: string;
  message: Message | null;
  fallbackIcon?: IconName;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.chatRow}>
      <View style={styles.chatAvatar}>
        {fallbackIcon ? (
          <Ionicons name={fallbackIcon} size={19} color={colors.amber} />
        ) : (
          <Avatar name={title} size="sm" />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.chatTop}>
          <AppText variant="label" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold }}>
            {title}
          </AppText>
          {message ? (
            <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10.5 }}>
              {faDate(message.created_at, "time")}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color={colors.muted} numberOfLines={1}>
          {message
            ? `${message.sender_username ?? "—"}: ${message.content.trim() || "📷 تصویر"}`
            : "هنوز پیامی نیست"}
        </AppText>
      </View>
      {badge > 0 ? <Badge count={badge} /> : null}
      <Ionicons name="chevron-back" size={14} color={colors.faint} />
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const now = useNow();
  const member = !canChat(user);

  const overview = useQuery({ queryKey: qk.overview, queryFn: fetchOverview });
  const assignments = useQuery({
    queryKey: qk.assignments,
    queryFn: () => fetchAssignments(),
  });
  const chats = useQuery({
    queryKey: qk.chatOverview,
    queryFn: fetchChatOverview,
    enabled: !member,
  });
  const team = useQuery({
    queryKey: qk.team,
    queryFn: fetchTeam,
    enabled: !member,
  });

  const refreshing =
    overview.isRefetching || assignments.isRefetching || chats.isRefetching;

  const refresh = () => {
    void overview.refetch();
    void assignments.refetch();
    if (!member) {
      void chats.refetch();
      void team.refetch();
    }
  };

  const me = overview.data?.me;
  const atRisk = Boolean(me && !me.completed_today);
  const pending = (assignments.data ?? [])
    .filter((item) => !item.is_completed_by_me)
    .sort((a, b) => {
      const da = parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    });

  const peerName = (peerId: number): string =>
    team.data?.find((memberUser) => memberUser.id === peerId)?.username ??
    "همکلاسی";

  return (
    <Screen edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/profile")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="پروفایل"
          >
            <Avatar
              name={user?.username}
              uri={user?.avatar_url}
              size="md"
              ring
            />
          </Pressable>
          <View style={{ flex: 1, gap: 0 }}>
            <AppText variant="subtitle">
              {greeting(now)}، {user?.username ?? "همکلاسی"}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {todayLabel(now)}
            </AppText>
          </View>
          <View style={styles.headerMark}>
            <Ionicons name="school-outline" size={18} color={colors.amber} />
          </View>
        </View>

        {overview.isError && !overview.data ? (
          <SolidCard style={{ marginHorizontal: screenGutter, marginBottom: spacing.md }}>
            <EmptyState
              icon="cloud-offline-outline"
              title="اطلاعات کلاس بارگذاری نشد"
              hint="اتصال اینترنت را بررسی کنید و دوباره تلاش کنید."
              actionLabel="تلاش دوباره"
              onAction={() => void overview.refetch()}
            />
          </SolidCard>
        ) : null}

        {overview.isLoading && !overview.data ? (
          <View style={{ paddingHorizontal: screenGutter }}>
            <SkeletonRows count={3} height={96} />
          </View>
        ) : null}

        {me ? (
          <>
            <Animated.View entering={FadeInDown.duration(460)} style={{ paddingHorizontal: screenGutter }}>
              <GlassCard glow={atRisk} contentStyle={styles.heroContent}>
                <View style={styles.heroRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.heroLabelRow}>
                      <AppText variant="label" color={colors.muted}>
                        زنجیرهٔ تو
                      </AppText>
                      <View style={styles.statusPill}>
                        <RiskDot active={atRisk} />
                        <AppText
                          variant="caption"
                          color={atRisk ? colors.red : colors.teal}
                          style={{ fontFamily: fonts.medium }}
                        >
                          {atRisk ? "در خطر" : "امروز ثبت شد"}
                        </AppText>
                      </View>
                    </View>

                    <View style={styles.streakRow}>
                      <AppText
                        variant="display"
                        color={colors.amber}
                        style={{ fontSize: 58, lineHeight: 66 }}
                        ltr
                      >
                        {fmtNum(me.current_streak)}
                      </AppText>
                      <AppText variant="subtitle" color={colors.muted} style={{ paddingBottom: 9 }}>
                        روز
                      </AppText>
                    </View>

                    <AppText variant="caption" color={colors.muted}>
                      بهترین: {fmtNum(me.best_streak)} روز · رکورد تیم:{" "}
                      {fmtNum(overview.data?.team_record_streak ?? 0)} روز
                    </AppText>
                  </View>

                  <WeekBars data={me.weekly_activity} />
                </View>

                <Divider style={{ marginVertical: spacing.sm }} />

                <View style={styles.heroFoot}>
                  <Ionicons
                    name={atRisk ? "flame-outline" : "checkmark-circle"}
                    size={15}
                    color={atRisk ? colors.red : colors.teal}
                  />
                  <AppText
                    variant="caption"
                    color={atRisk ? colors.textSoft : colors.muted}
                    style={{ flex: 1 }}
                  >
                    {atRisk
                      ? "هنوز امروز تکلیفی تحویل ندادی؛ یک مورد را انجام بده تا زنجیره نشکند."
                      : "زنجیرهٔ امروز ثبت شد. فردا هم ادامه بده."}
                  </AppText>
                </View>
              </GlassCard>
            </Animated.View>

            <View style={styles.statsRow}>
              <StatTile
                label="درصد کلاس"
                value={fmtPercent(overview.data?.class_completion_percentage ?? 0)}
                icon="analytics-outline"
                tone={colors.amber}
              />
              <StatTile
                label="تحویل‌ها"
                value={fmtNum(overview.data?.total_completions ?? 0)}
                icon="checkmark-done-outline"
                tone={colors.teal}
              />
              <StatTile
                label="فعال"
                value={fmtNum(overview.data?.active_users ?? 0)}
                icon="people-outline"
                tone={colors.blue}
              />
            </View>

            <Animated.View entering={FadeInDown.duration(460).delay(80)} style={styles.section}>
              <SectionTitle
                title="رتبه‌های برتر"
                actionLabel="همه"
                onAction={() => router.push("/leaderboard")}
              />
              <SolidCard style={{ paddingHorizontal: spacing.md }}>
                {(overview.data?.top_users ?? []).slice(0, 3).map((entry, index) => (
                  <View key={entry.user.id}>
                    {index > 0 ? <Divider /> : null}
                    <RankRow entry={entry} onPress={() => router.push("/leaderboard")} />
                  </View>
                ))}
                {(overview.data?.top_users ?? []).length === 0 ? (
                  <EmptyState
                    compact
                    icon="podium-outline"
                    title="هنوز رتبه‌ای ثبت نشده"
                  />
                ) : null}
              </SolidCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(460).delay(140)} style={styles.section}>
              <SectionTitle
                title="نزدیک‌ترین مهلت‌ها"
                hint={pending.length ? `${fmtNum(pending.length)} تکلیف باز` : undefined}
                actionLabel="تکالیف"
                onAction={() => router.push("/assignments")}
              />
              <SolidCard style={{ paddingHorizontal: spacing.md }}>
                {pending.slice(0, 4).map((assignment, index) => (
                  <View key={assignment.id}>
                    {index > 0 ? <Divider /> : null}
                    <DeadlineRow
                      assignment={assignment}
                      now={now}
                      onPress={() =>
                        router.push({
                          pathname: "/assignment/[id]",
                          params: { id: String(assignment.id) },
                        })
                      }
                    />
                  </View>
                ))}
                {pending.length === 0 ? (
                  <EmptyState
                    compact
                    icon="checkmark-done-circle-outline"
                    title="همه‌چیز تحویل شده"
                    hint="مهلت بازی باقی نمانده است."
                  />
                ) : null}
              </SolidCard>
            </Animated.View>

            {!member ? (
              <Animated.View entering={FadeInDown.duration(460).delay(200)} style={styles.section}>
                <SectionTitle
                  title="گفتگوهای تازه"
                  actionLabel="گفتگو"
                  onAction={() => router.push("/chat")}
                />
                <SolidCard style={{ paddingHorizontal: spacing.md }}>
                  <ChatPreview
                    title="گفتگوی کلاس"
                    message={chats.data?.global_message ?? null}
                    fallbackIcon="people-outline"
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[room]",
                        params: { room: "global" },
                      })
                    }
                  />
                  {(chats.data?.directs ?? []).slice(0, 3).map((direct) => (
                    <View key={direct.peer_id}>
                      <Divider />
                      <ChatPreview
                        title={peerName(direct.peer_id)}
                        message={direct.message}
                        onPress={() =>
                          router.push({
                            pathname: "/chat/[room]",
                            params: {
                              room: dmRoom(user?.id ?? 0, direct.peer_id),
                            },
                          })
                        }
                      />
                    </View>
                  ))}
                  {(chats.data?.directs ?? []).length === 0 ? (
                    <View style={styles.chatEmpty}>
                      <AppText variant="caption" color={colors.faint}>
                        گفتگوی خصوصی تازه‌ای نداری.
                      </AppText>
                    </View>
                  ) : null}
                </SolidCard>
              </Animated.View>
            ) : null}
          </>
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xs, paddingBottom: 120 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  headerMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  heroContent: { padding: spacing.lg, gap: 0 },
  heroRow: { flexDirection: "row-reverse", alignItems: "flex-end", gap: spacing.md },
  heroLabelRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  streakRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 5,
  },
  heroFoot: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: "row-reverse",
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.md,
  },
  section: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xl,
  },
  rankRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rankTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  rankTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  rankFill: { height: "100%", borderRadius: 2 },
  deadlineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  deadlineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chatRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  chatTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  chatEmpty: { paddingVertical: spacing.md, alignItems: "center" },
});
