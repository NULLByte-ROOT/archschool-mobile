import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchAssignments,
  fetchChatOverview,
  fetchOverview,
  fetchTeam,
  qk,
} from "@/api/client";
import type { Assignment, DailyActivity, LeaderboardEntry, Message } from "@/api/types";
import { SchoolStatusStrip } from "@/components/SchoolStatusStrip";
import { Screen } from "@/components/Screen";
import { AppText, Avatar } from "@/components/ui";
import {
  IconTile,
  Kicker,
  MiniStat,
  MonoLabel,
  Panel,
  PanelHeader,
  PulseDot,
} from "@/components/webui";
import { useNow } from "@/hooks/useNow";
import { dmRoom } from "@/lib/chat";
import {
  DAY_MS,
  fmtNum,
  fmtPercent,
  formatDue,
  parseDue,
  relativeDue,
  todayLabel,
} from "@/lib/format";
import { canChat } from "@/lib/roles";
import { dayForDate, flattenDay, type TimetableEntry } from "@/lib/timetable";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------ */
/* 1. Welcome card                                                     */
/* ------------------------------------------------------------------ */

function WelcomeCard({ username, now }: { username: string; now: number }) {
  return (
    <View style={st.welcome}>
      <View style={st.welcomeRight}>
        <View style={st.welcomeIcon}>
          <Ionicons name="calendar-outline" size={18} color={colors.white} />
          <View style={st.welcomeDot}>
            <PulseDot size={9} tone={colors.success} />
          </View>
        </View>
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <AppText
            numberOfLines={1}
            style={{ fontFamily: fonts.black, fontSize: 15, lineHeight: 22 }}
          >
            سلام {username} 👋
          </AppText>
          <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 11, lineHeight: 16 }}>
            امروز: {todayLabel(now)}
          </AppText>
        </View>
      </View>

      <View style={st.welcomeLeft}>
        <View style={st.clockPill}>
          <Ionicons name="time-outline" size={13} color={colors.faint} />
          <AppText
            ltr
            color={colors.text}
            style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 }}
          >
            {new Date(now).toLocaleTimeString("fa-IR-u-nu-latn", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </AppText>
        </View>
        <Kicker text="dashboard" dot />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Streak hero                                                      */
/* ------------------------------------------------------------------ */

function FlameGlyph({ atRisk }: { atRisk: boolean }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
    rotate.value = withRepeat(
      withSequence(withTiming(-5, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1,
      true
    );
  }, [rotate, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons
        name="flame"
        size={40}
        color={atRisk ? colors.danger : colors.flame}
      />
    </Animated.View>
  );
}

function RiskRing({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = visible
      ? withRepeat(
          withSequence(
            withTiming(1, { duration: 750 }),
            withTiming(0.25, { duration: 750 })
          ),
          -1,
          true
        )
      : withTiming(0, { duration: 200 });
  }, [opacity, visible]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, st.riskRing, style]}
    />
  );
}

function StreakHero({
  streak,
  best,
  teamRecord,
  atRisk,
  onOpen,
  onFix,
}: {
  streak: number;
  best: number;
  teamRecord: number;
  atRisk: boolean;
  onOpen: () => void;
  onFix: () => void;
}) {
  const subtitle = atRisk
    ? "امروز هنوز هیچ تکلیفی را انجام ندادی."
    : streak > 0
      ? "استریکت را حفظ کردی — همین‌طور ادامه بده 🔥"
      : "امروز اولین روز استریک جدیدت می‌تواند باشد.";

  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="استریک من">
      <View
        style={[
          st.hero,
          {
            borderColor: atRisk ? colors.heroRiskLine : colors.heroCalmLine,
            backgroundColor: atRisk ? colors.heroRiskBg : colors.heroCalmBg,
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={
            atRisk
              ? ["rgba(239,68,68,0.20)", "rgba(239,68,68,0)"]
              : ["rgba(249,115,22,0.20)", "rgba(245,158,11,0)"]
          }
          start={{ x: 0.75, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RiskRing visible={atRisk} />

        <View style={st.heroBody}>
          <View style={st.heroRow}>
            <View
              style={[
                st.heroIcon,
                {
                  borderColor: atRisk
                    ? "rgba(248,113,113,0.35)"
                    : "rgba(251,146,60,0.35)",
                  backgroundColor: atRisk
                    ? "rgba(239,68,68,0.14)"
                    : "rgba(249,115,22,0.14)",
                },
              ]}
            >
              <FlameGlyph atRisk={atRisk} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <MonoLabel>// MY STREAK</MonoLabel>
              <View style={st.streakRow}>
                <AppText
                  ltr
                  style={{
                    fontFamily: fonts.black,
                    fontSize: 58,
                    lineHeight: 62,
                    fontVariant: ["tabular-nums"],
                    color: atRisk ? "#fca5a5" : colors.flame,
                  }}
                >
                  {fmtNum(streak)}
                </AppText>
                <AppText
                  color="rgba(254,215,170,0.80)"
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 14,
                    lineHeight: 20,
                    paddingBottom: 9,
                  }}
                >
                  روز متوالی
                </AppText>
              </View>
              <AppText
                color={colors.faint}
                style={{ fontSize: 12, lineHeight: 20, marginTop: 2 }}
              >
                {subtitle}
              </AppText>
            </View>
          </View>

          <View style={st.heroGrid}>
            <View style={st.heroStat}>
              <View style={st.heroStatLabel}>
                <Ionicons name="trophy" size={11} color={colors.amber} />
                <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 14 }}>
                  رکورد تیم
                </AppText>
              </View>
              <AppText style={{ fontFamily: fonts.black, fontSize: 15, lineHeight: 22 }}>
                <AppText style={{ fontFamily: fonts.black }}>{fmtNum(teamRecord)}</AppText> روز
              </AppText>
            </View>

            <View style={st.heroStat}>
              <View style={st.heroStatLabel}>
                <Ionicons name="sparkles" size={11} color="#fdba74" />
                <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 14 }}>
                  بهترین تو
                </AppText>
              </View>
              <AppText style={{ fontFamily: fonts.black, fontSize: 15, lineHeight: 22 }}>
                <AppText style={{ fontFamily: fonts.black }}>{fmtNum(best)}</AppText> روز
              </AppText>
            </View>

            <View style={st.heroCta}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                <Ionicons name="trophy" size={12} color={colors.amber} />
                <AppText
                  color={colors.textSoft}
                  style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 }}
                >
                  لیدر بورد
                </AppText>
              </View>
              <Ionicons name="arrow-up-outline" size={14} color={colors.faint} style={{ transform: [{ rotate: "45deg" }] }} />
            </View>
          </View>
        </View>

        {atRisk ? (
          <View style={st.riskBanner}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
              <AppText style={{ fontSize: 13 }}>⚠️</AppText>
              <AppText
                color="#fecaca"
                style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 24, flex: 1 }}
              >
                استریک شما در خطر است! امروز هیچ تکلیفی انجام ندادی.
              </AppText>
            </View>
            <Pressable
              onPress={onFix}
              style={st.riskButton}
              accessibilityRole="button"
              accessibilityLabel="همین حالا انجام بده"
            >
              <Ionicons name="checkmark-circle" size={13} color="#fee2e2" />
              <AppText color="#fee2e2" style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 }}>
                همین حالا انجام بده
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* 3. «تکالیف من» CTA                                                  */
/* ------------------------------------------------------------------ */

function AssignmentsCta({
  pending,
  urgent,
  onOpen,
}: {
  pending: number;
  urgent: number;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="تکالیف من">
      <View style={st.cta}>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.045)", "rgba(255,255,255,0)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={st.ctaTop}>
          <View style={st.ctaIcon}>
            <Ionicons name="clipboard" size={22} color={colors.black} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <MonoLabel>// ASSIGNMENTS</MonoLabel>
            <AppText style={{ fontFamily: fonts.black, fontSize: 18, lineHeight: 26 }}>
              تکالیف من
            </AppText>
            <AppText color={colors.textSoft} style={{ fontSize: 11.5, lineHeight: 18, marginTop: 2 }}>
              <AppText color={colors.white} style={{ fontFamily: fonts.bold }}>
                {fmtNum(pending)}
              </AppText>{" "}
              تکلیف باقی‌مانده
              {urgent > 0 ? (
                <>
                  <AppText color={colors.faint}> · </AppText>
                  <AppText color="#fca5a5" style={{ fontFamily: fonts.bold }}>
                    {fmtNum(urgent)} فوری
                  </AppText>
                </>
              ) : null}
            </AppText>
          </View>
        </View>

        <View style={st.ctaPill}>
          <AppText
            color={colors.black}
            style={{ fontFamily: fonts.black, fontSize: 12, lineHeight: 18 }}
          >
            مشاهده تکالیف
          </AppText>
          <Ionicons
            name="arrow-up-outline"
            size={15}
            color={colors.black}
            style={{ transform: [{ rotate: "45deg" }] }}
          />
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Class pulse                                                      */
/* ------------------------------------------------------------------ */

function ClassPulse({
  percentage,
  total,
  completions,
  activeUsers,
  onOpen,
}: {
  percentage: number;
  total: number;
  completions: number;
  activeUsers: number;
  onOpen: () => void;
}) {
  return (
    <Panel corners onPress={onOpen} accessibilityLabel="وضعیت کلی کلاس" contentStyle={st.panelPad}>
      <PanelHeader
        label="// CLASS PULSE"
        title="وضعیت کلی کلاس"
        icon="people"
        accessory={<Ionicons name="arrow-up-outline" size={16} color={colors.faint} style={{ transform: [{ rotate: "45deg" }] }} />}
      />

      <View style={{ marginBottom: 16 }}>
        <View style={st.pulseRow}>
          <AppText
            ltr
            style={{
              fontFamily: fonts.black,
              fontSize: 30,
              lineHeight: 36,
              fontVariant: ["tabular-nums"],
            }}
          >
            {fmtPercent(percentage, 1)}
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 16 }}>
            تکمیل کل کلاس
          </AppText>
        </View>
        <View style={st.pulseTrack}>
          <View
            style={[
              st.pulseFillWrap,
              { width: `${Math.max(1.5, Math.min(100, percentage))}%` },
            ]}
          >
            <LinearGradient
              colors={["#d1fae5", "#6ee7b7", "#34d399"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>
      </View>

      <View style={st.miniRow}>
        <MiniStat icon="clipboard" label="کل تکالیف" value={fmtNum(total)} />
        <MiniStat icon="checkmark-circle" label="تکمیل‌ها" value={fmtNum(completions)} />
        <MiniStat icon="people" label="اعضای فعال" value={fmtNum(activeUsers)} />
      </View>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Top three                                                        */
/* ------------------------------------------------------------------ */

function TopThree({
  entries,
  loading,
  onOpen,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <Panel corners onPress={onOpen} accessibilityLabel="صدر جدول" contentStyle={st.panelPad}>
      <PanelHeader
        label="// TOP 3"
        title="صدر جدول"
        icon="trophy"
        iconTone={colors.amber}
        iconBorder="rgba(251,191,36,0.25)"
        iconBackground="rgba(251,191,36,0.10)"
        accessory={<Ionicons name="arrow-up-outline" size={16} color={colors.faint} style={{ transform: [{ rotate: "45deg" }] }} />}
      />

      {loading && entries.length === 0 ? (
        <View style={st.centerBox}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            در حال بارگذاری…
          </AppText>
        </View>
      ) : entries.length === 0 ? (
        <View style={st.centerBox}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            هنوز رتبه‌ای ثبت نشده
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {entries.slice(0, 3).map((entry) => {
            const medal =
              entry.rank === 1
                ? colors.rankGold
                : entry.rank === 2
                  ? colors.rankSilver
                  : colors.rankBronze;
            return (
              <View key={entry.user.id} style={st.topRow}>
                <View style={[st.medal, { backgroundColor: medal }]}>
                  <AppText
                    align="center"
                    color={colors.black}
                    style={{ fontFamily: fonts.black, fontSize: 10, lineHeight: 14 }}
                  >
                    {fmtNum(entry.rank)}
                  </AppText>
                </View>

                <Avatar name={entry.user.username} uri={entry.user.avatar_url} size="xs" />

                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={st.topNameRow}>
                    <AppText
                      ltr
                      numberOfLines={1}
                      style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 17, flex: 1 }}
                    >
                      {entry.user.username}
                    </AppText>
                    {entry.current_streak > 0 ? (
                      <View style={st.streakChip}>
                        <Ionicons name="flame" size={9} color={colors.flameText} />
                        <AppText
                          ltr
                          color={colors.flameText}
                          style={{ fontFamily: fonts.black, fontSize: 9, lineHeight: 13 }}
                        >
                          {fmtNum(entry.current_streak)}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <View style={st.miniTrack}>
                    <View
                      style={[
                        st.miniFill,
                        {
                          width: `${Math.max(1.5, Math.min(100, entry.completion_percentage))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <AppText
                  ltr
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 11,
                    lineHeight: 16,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {fmtPercent(entry.completion_percentage, 1)}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 6. My focus                                                         */
/* ------------------------------------------------------------------ */

function FocusPanel({
  pendingCount,
  urgentCount,
  doneCount,
  next,
  now,
  onOpen,
  loading,
}: {
  pendingCount: number;
  urgentCount: number;
  doneCount: number;
  next: Assignment[];
  now: number;
  onOpen: () => void;
  loading: boolean;
}) {
  return (
    <Panel corners onPress={onOpen} accessibilityLabel="تمرکز من" contentStyle={st.panelPad}>
      <PanelHeader
        label="// MY FOCUS"
        title="تمرکز من"
        icon="locate"
        iconTone={colors.danger}
        accessory={<Ionicons name="arrow-up-outline" size={16} color={colors.faint} style={{ transform: [{ rotate: "45deg" }] }} />}
      />

      <View style={[st.miniRow, { marginBottom: 12 }]}>
        <MiniStat icon="ellipse-outline" label="در جریان" value={fmtNum(pendingCount)} />
        <MiniStat
          icon="flame"
          label="فوری"
          value={fmtNum(urgentCount)}
          tone={colors.danger}
        />
        <MiniStat
          icon="checkmark-circle"
          label="انجام‌شده"
          value={fmtNum(doneCount)}
          tone={colors.success}
        />
      </View>

      {loading && next.length === 0 ? (
        <View style={st.centerBox}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            در حال بارگذاری…
          </AppText>
        </View>
      ) : next.length === 0 ? (
        <View style={st.centerBox}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            تکلیف بازِ سررسیده‌ای نداری ✨
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {next.slice(0, 2).map((item) => (
            <View key={item.id} style={st.focusRow}>
              <PulseDot size={6} tone={colors.danger} glow={false} />
              <AppText
                numberOfLines={1}
                color={colors.textSoft}
                style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, flex: 1 }}
              >
                {item.title}
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 9.5, lineHeight: 14 }}>
                {relativeDue(item.due_date, now)}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Pulse (latest news)                                              */
/* ------------------------------------------------------------------ */

interface PulseItem {
  key: string;
  kind: "global" | "dm";
  room: string;
  sender: string;
  avatar?: string | null;
  preview: string;
  createdAt: string;
  peerId?: number;
}

function PulseBox({
  items,
  unread,
  onOpen,
}: {
  items: PulseItem[];
  unread: number;
  onOpen: (item: PulseItem) => void;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setTick((value) => value + 1), 3000);
    return () => clearInterval(id);
  }, [items.length]);

  const current = items.length ? items[tick % items.length] : null;

  return (
    <Panel
      corners
      onPress={() => (current ? onOpen(current) : undefined)}
      accessibilityLabel="آخرین خبرها"
      style={st.pulsePanel}
      contentStyle={st.panelPad}
    >
      <View style={st.pulseHeader}>
        <View style={st.pulseHeaderRight}>
          <IconTile name="logo-rss" size={36} iconSize={16} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <MonoLabel>// PULSE — جنبِش</MonoLabel>
            <AppText
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}
            >
              آخرین خبر‌ها
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Kicker text="live" dot />
          {unread > 0 ? (
            <View style={st.unreadPill}>
              <AppText
                ltr
                color={colors.black}
                style={{ fontFamily: fonts.black, fontSize: 11, lineHeight: 16 }}
              >
                {unread > 99 ? "99+" : fmtNum(unread)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={st.ticker}>
        {current ? (
          <Animated.View
            key={current.key}
            entering={FadeIn.duration(420)}
            style={st.tickerRow}
          >
            {current.kind === "global" ? (
              <View style={st.tickerIcon}>
                <Ionicons name="logo-rss" size={14} color={colors.white} />
              </View>
            ) : (
              <Avatar name={current.sender} uri={current.avatar} size="sm" />
            )}

            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={st.tickerTop}>
                <AppText
                  ltr
                  numberOfLines={1}
                  style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 18, flexShrink: 1 }}
                >
                  {current.sender}
                </AppText>
                <View style={st.kindChip}>
                  <AppText
                    color={colors.textSoft}
                    style={{ fontFamily: fonts.semibold, fontSize: 9, lineHeight: 13 }}
                  >
                    {current.kind === "global" ? "گفتگوی عمومی" : "پیام خصوصی"}
                  </AppText>
                </View>
                <AppText
                  ltr
                  color={colors.faint}
                  style={{ fontSize: 9, lineHeight: 13, fontVariant: ["tabular-nums"] }}
                >
                  {new Date(current.createdAt).toLocaleTimeString("fa-IR-u-nu-latn", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </AppText>
              </View>
              <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 12, lineHeight: 18 }}>
                {current.preview}
              </AppText>
            </View>

            <Ionicons
              name="arrow-up-outline"
              size={15}
              color={colors.faint}
              style={{ transform: [{ rotate: "45deg" }] }}
            />
          </Animated.View>
        ) : (
          <AppText align="center" color={colors.faint} style={{ fontSize: 11, lineHeight: 16, flex: 1 }}>
            فعلاً خبری نیست — اولین پیام، همین‌جا می‌درخشد.
          </AppText>
        )}
      </View>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 8. 7-day class trend                                                */
/* ------------------------------------------------------------------ */

function TrendPanel({
  trend,
  onOpen,
}: {
  trend: DailyActivity[];
  onOpen: () => void;
}) {
  const days = trend.slice(-7);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <Panel corners onPress={onOpen} accessibilityLabel="روند ۷ روز کلاس" contentStyle={st.panelPad}>
      <PanelHeader
        label="// CLASS TREND"
        title="روند ۷ روز کلاس"
        icon="trending-up"
        iconTone={colors.success}
        accessory={
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            <Kicker text={`${fmtNum(total)} تکمیل`} />
            <IconTile name="arrow-up-outline" size={32} iconSize={15} tone={colors.textSoft} />
          </View>
        }
      />

      {total === 0 ? (
        <View style={[st.centerBox, { paddingVertical: 28 }]}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            هنوز تکمیل‌ای در هفت روز گذشته ثبت نشده
          </AppText>
        </View>
      ) : (
        <View style={st.trend}>
          {days.map((day, index) => {
            const height = 8 + Math.round((day.count / max) * 96);
            const date = new Date(`${day.date.slice(0, 10)}T00:00:00Z`);
            const label = Number.isNaN(date.getTime())
              ? ""
              : date.toLocaleDateString("fa-IR-u-nu-latn", { weekday: "short" });
            return (
              <View key={`${day.date}-${index}`} style={st.trendCol}>
                <AppText
                  ltr
                  color={colors.textSoft}
                  style={{ fontSize: 9.5, lineHeight: 13, fontVariant: ["tabular-nums"] }}
                >
                  {fmtNum(day.count)}
                </AppText>
                <View style={[st.trendBar, { height }]}>
                  <LinearGradient
                    colors={["#6ee7b7", "#34d399"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <AppText
                  align="center"
                  color={colors.faint}
                  style={{ fontSize: 9, lineHeight: 13 }}
                >
                  {label}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Tomorrow                                                        */
/* ------------------------------------------------------------------ */

interface TomorrowRow extends TimetableEntry {
  events: Assignment[];
  tone: "red" | "yellow" | "none";
}

function TomorrowPanel({ rows, onOpen }: { rows: TomorrowRow[]; onOpen: () => void }) {
  const today = new Date();
  const next = new Date(today.getTime() + DAY_MS);
  const day = dayForDate(next);
  const isWeekend = [4, 5].includes(next.getDay());
  const totalEvents = rows.reduce((sum, row) => sum + row.events.length, 0);

  return (
    <Panel corners onPress={onOpen} accessibilityLabel="برنامه فردا" contentStyle={st.panelPad}>
      <View style={st.tomorrowHeader}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, flexShrink: 1 }}>
          <IconTile name="calendar-outline" size={40} iconSize={18} tone={colors.white} border={colors.white15} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <AppText
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}
            >
              {isWeekend ? "فردا تعطیل است" : "فردا چه کلاسی داریم؟"}
            </AppText>
            <MonoLabel>
              {`// NEXT DAY${day ? ` · ${day.name.toUpperCase()}` : ""}`}
            </MonoLabel>
          </View>
        </View>
        <Kicker text={totalEvents > 0 ? `فردا · ${fmtNum(totalEvents)} رویداد` : "فردا"} dot />
      </View>

      {!day || rows.length === 0 ? (
        <View style={st.tomorrowEmpty}>
          <Ionicons name="moon" size={26} color={colors.faint} />
          <AppText align="center" color={colors.faint} style={{ fontSize: 14, lineHeight: 22 }}>
            {isWeekend ? "تعطیلات آخر هفته — کلاسی نداریم" : "روز بعد کلاسی نداریم"}
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((row, index) => {
            const toneColor =
              row.tone === "red" ? "#f87171" : row.tone === "yellow" ? "#facc15" : colors.textSoft;
            const borderColor =
              row.events.length === 0
                ? colors.white10
                : row.tone === "red"
                  ? "#ef4444"
                  : row.tone === "yellow"
                    ? "#eab308"
                    : colors.white10;
            const isExam = row.events.some((event) => event.category === "exam");
            const nearest = row.events[0];
            return (
              <View
                key={`${row.label}-${index}`}
                style={[st.tomorrowRow, { borderColor }]}
              >
                <IconTile
                  name={isExam ? "school" : "book"}
                  size={44}
                  iconSize={18}
                  tone={colors.white}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    numberOfLines={1}
                    style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 }}
                  >
                    {row.subject?.name ?? "زنگ آزاد"}
                  </AppText>
                  <AppText
                    numberOfLines={1}
                    color={colors.faint}
                    style={{ fontSize: 11, lineHeight: 16, marginTop: 2 }}
                  >
                    {row.subject?.teacher ?? "—"} · {row.label}
                  </AppText>
                  {nearest ? (
                    <AppText
                      numberOfLines={1}
                      color={colors.faint}
                      style={{ fontSize: 10, lineHeight: 15, marginTop: 2 }}
                    >
                      {relativeDue(nearest.due_date, Date.now())}
                      <AppText color={toneColor}>{"  "}</AppText>
                    </AppText>
                  ) : null}
                </View>
                {row.events.length > 0 ? (
                  <View
                    style={[
                      st.eventPill,
                      {
                        borderColor:
                          row.tone === "red"
                            ? "rgba(239,68,68,0.40)"
                            : row.tone === "yellow"
                              ? "rgba(234,179,8,0.40)"
                              : colors.white12,
                        backgroundColor:
                          row.tone === "red"
                            ? "rgba(239,68,68,0.10)"
                            : row.tone === "yellow"
                              ? "rgba(234,179,8,0.10)"
                              : colors.white04,
                      },
                    ]}
                  >
                    <PulseDot
                      size={6}
                      tone={
                        row.tone === "red" ? "#ef4444" : row.tone === "yellow" ? "#eab308" : colors.white
                      }
                      glow={false}
                    />
                    <AppText color={toneColor} style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 14 }}>
                      {isExam ? "امتحان" : "تکلیف"}
                    </AppText>
                    <AppText
                      ltr
                      color={toneColor}
                      style={{ fontSize: 10, lineHeight: 14, fontVariant: ["tabular-nums"] }}
                    >
                      {fmtNum(row.events.length)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const team = useQuery({ queryKey: qk.team, queryFn: fetchTeam, enabled: !member });

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
  const pending = useMemo(
    () =>
      (assignments.data ?? [])
        .filter((item) => !item.is_completed_by_me)
        .sort((a, b) => {
          const da = parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
          const db = parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
          return da - db;
        }),
    [assignments.data]
  );

  const urgent = pending.filter((item) => {
    const due = parseDue(item.due_date);
    return Boolean(due && due.getTime() - now < 48 * HOUR_MS);
  });

  const peerName = (peerId: number): string =>
    team.data?.find((entry) => entry.id === peerId)?.username ?? "همکلاسی";

  const pulseItems = useMemo<PulseItem[]>(() => {
    const items: PulseItem[] = [];
    const global = chats.data?.global_message;
    if (global) {
      items.push({
        key: `g-${global.id}`,
        kind: "global",
        room: "global",
        sender: global.sender_username ?? "کاربر",
        preview: global.content.trim() || "📎 فایل ضمیمه",
        createdAt: global.created_at,
      });
    }
    for (const direct of chats.data?.directs ?? []) {
      items.push({
        key: `d-${direct.peer_id}-${direct.message.id}`,
        kind: "dm",
        room: dmRoom(user?.id ?? 0, direct.peer_id),
        peerId: direct.peer_id,
        sender: peerName(direct.peer_id),
        avatar: direct.message.sender_avatar_url,
        preview: direct.message.content.trim() || "📎 فایل ضمیمه",
        createdAt: direct.message.created_at,
      });
    }
    return items
      .sort((a, b) => parseDue(b.createdAt)!.getTime() - parseDue(a.createdAt)!.getTime())
      .slice(0, 6);
  }, [chats.data, team.data, user?.id]);

  // The chat badge mirrors the unread socket summary; the dashboard only needs
  // a coarse number, and `chats.data` presence is enough to know we may show it.
  const unread = 0;

  const tomorrowRows = useMemo<TomorrowRow[]>(() => {
    const day = dayForDate(new Date(Date.now() + DAY_MS));
    if (!day) return [];
    return flattenDay(day).map((entry) => {
      const events = pending
        .filter((item) => entry.subject && item.subject_id === entry.subject.id)
        .sort((a, b) => {
          const da = parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
          const db = parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
          return da - db;
        });
      const nearest = events[0];
      const due = nearest ? parseDue(nearest.due_date) : null;
      const tone: TomorrowRow["tone"] = !due
        ? "none"
        : due.getTime() < Date.now()
          ? "red"
          : due.getTime() - Date.now() < DAY_MS
            ? "red"
            : "yellow";
      return { ...entry, events, tone };
    });
  }, [pending]);

  return (
    <Screen edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          st.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
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
        <Animated.View entering={FadeInDown.duration(380)}>
          <WelcomeCard username={user?.username ?? "همکلاسی"} now={now} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(380).delay(30)} style={{ marginBottom: 16 }}>
          <SchoolStatusStrip />
        </Animated.View>

        {overview.isError && !overview.data ? (
          <Panel contentStyle={{ padding: 24 }} style={{ marginBottom: 16 }}>
            <AppText align="center" style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              اطلاعات کلاس بارگذاری نشد
            </AppText>
            <AppText align="center" color={colors.faint} style={{ fontSize: 12, marginTop: 6 }}>
              اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.
            </AppText>
          </Panel>
        ) : null}

        {me ? (
          <Animated.View entering={FadeInDown.duration(420).delay(20)} style={{ marginBottom: 16 }}>
            <StreakHero
              streak={me.current_streak}
              best={me.best_streak}
              teamRecord={overview.data?.team_record_streak ?? 0}
              atRisk={!me.completed_today}
              onOpen={() => router.push("/leaderboard")}
              onFix={() => router.push("/assignments")}
            />
          </Animated.View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <Panel contentStyle={{ padding: 20 }}>
              <View style={st.centerBox}>
                <AppText color={colors.faint} style={{ fontSize: 12 }}>
                  در حال بارگذاری…
                </AppText>
              </View>
            </Panel>
          </View>
        )}

        <Animated.View entering={FadeInDown.duration(420).delay(50)} style={{ marginBottom: 16 }}>
          <AssignmentsCta
            pending={pending.length}
            urgent={urgent.length}
            onOpen={() => router.push("/assignments")}
          />
        </Animated.View>

        <View style={{ gap: 16, marginBottom: 16 }}>
          <ClassPulse
            percentage={overview.data?.class_completion_percentage ?? 0}
            total={overview.data?.total_assignments ?? 0}
            completions={overview.data?.total_completions ?? 0}
            activeUsers={overview.data?.active_users ?? 0}
            onOpen={() => router.push("/leaderboard")}
          />

          <TopThree
            entries={overview.data?.top_users ?? []}
            loading={overview.isLoading}
            onOpen={() => router.push("/leaderboard")}
          />

          <FocusPanel
            pendingCount={pending.length}
            urgentCount={urgent.length}
            doneCount={me?.completed_count ?? 0}
            next={pending}
            now={now}
            loading={assignments.isLoading}
            onOpen={() => router.push("/assignments")}
          />
        </View>

        {!member ? (
          <Animated.View entering={FadeInDown.duration(420).delay(90)} style={{ marginBottom: 20 }}>
            <PulseBox
              items={pulseItems}
              unread={unread}
              onOpen={(item) =>
                router.push({
                  pathname: "/chat/[room]",
                  params: { room: item.room },
                })
              }
            />
          </Animated.View>
        ) : null}

        <View style={{ gap: 16 }}>
          <TrendPanel
            trend={overview.data?.weekly_trend ?? []}
            onOpen={() => router.push("/leaderboard")}
          />
          <TomorrowPanel rows={tomorrowRows} onOpen={() => router.push("/timetable")} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
  },

  /* welcome */
  welcome: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelPhone,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  welcomeRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flexShrink: 1,
  },
  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  welcomeDot: { position: "absolute", bottom: -3, left: -3 },
  welcomeLeft: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  clockPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
  },

  /* hero */
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    overflow: "hidden",
  },
  riskRing: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.60)",
  },
  heroBody: { gap: spacing.lg },
  heroRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  streakRow: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 8 },
  heroGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStat: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  heroStatLabel: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  heroCta: {
    flexBasis: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  riskBanner: {
    marginTop: 16,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.10)",
    padding: 12,
  },
  riskButton: {
    minHeight: 36,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.40)",
    backgroundColor: "rgba(239,68,68,0.20)",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  /* assignments CTA */
  cta: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    padding: spacing.md,
    gap: 12,
    overflow: "hidden",
  },
  ctaTop: { flexDirection: "row-reverse", alignItems: "center", gap: 14 },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  ctaPill: {
    alignSelf: "flex-start",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  /* panels */
  panelPad: { padding: spacing.lg },
  pulsePanel: { borderRadius: radius.lg },
  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  pulseRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  pulseTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white06,
    overflow: "hidden",
  },
  pulseFillWrap: { height: "100%", borderRadius: radius.pill, overflow: "hidden" },
  miniRow: { flexDirection: "row-reverse", gap: 8 },

  /* top three */
  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  medal: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  topNameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  streakChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.35)",
    backgroundColor: colors.flameSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white06,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "rgba(251,191,36,0.80)",
  },

  /* focus */
  focusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  /* pulse */
  pulseHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 16,
  },
  pulseHeaderRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  unreadPill: {
    height: 24,
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  ticker: {
    minHeight: 52,
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tickerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, flex: 1 },
  tickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: colors.white06,
  },
  tickerTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  kindChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },

  /* trend */
  trend: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 4,
  },
  trendCol: { flex: 1, alignItems: "center", gap: 4 },
  trendBar: {
    width: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: colors.white06,
  },

  /* tomorrow */
  tomorrowHeader: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  tomorrowEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white12,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  tomorrowRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 14,
  },
  eventPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
