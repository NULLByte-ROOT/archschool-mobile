import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { fetchAssignments, qk } from "@/api/client";
import type { Assignment } from "@/api/types";
import { AppText } from "@/components/ui";
import { MonoLabel, Panel, PulseDot } from "@/components/webui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, type CurrentBellState } from "@/lib/bell";
import { fmtNum, parseDue } from "@/lib/format";
import {
  TIMETABLE,
  dayForDate,
  flattenDay,
  type Day,
  type TimetableEntry,
} from "@/lib/timetable";
import { colors, fonts, radius, spacing } from "@/theme/tokens";
import { useAuthStore } from "@/store/auth";

type IconName = ComponentProps<typeof Ionicons>["name"];

const TONE_COLOR = {
  red: colors.red,
  amber: colors.amber,
  none: "rgba(255,255,255,0.35)",
} as const;

const TONE_BORDER = {
  red: "rgba(248,113,113,0.35)",
  amber: "rgba(255,255,255,0.30)",
  none: colors.white10,
} as const;

function groupBySubject(items: Assignment[]): Record<string, Assignment[]> {
  const out: Record<string, Assignment[]> = {};
  for (const item of items) {
    if (!item.subject_id) continue;
    (out[item.subject_id] ??= []).push(item);
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => {
      const da = parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }
  return out;
}

function dueTone(due: string | null | undefined): "red" | "amber" | "none" {
  const date = parseDue(due);
  if (!date) return "none";
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "none"; // Past/overdue tasks should not paint tomorrow's schedule red
  if (diff <= 86_400_000) return "red";
  if (diff <= 86_400_000 * 2) return "amber";
  return "none";
}

/** `MM:SS` (or `H:MM:SS`) — Latin digits, tabular. */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function iconFor(state: CurrentBellState): IconName {
  if (state.state === "class") return "alarm-outline";
  if (state.state === "break") return "cafe-outline";
  if (state.state === "before") return "sunny-outline";
  if (state.state === "holiday") return "moon-outline";
  return "checkmark-circle-outline";
}

export interface SchoolStatusCardProps {
  onPress?: () => void;
  showNextDay?: boolean;
}

/**
 * «وضعیت کلاس و برنامه روز بعد»
 * Redesigned class status card with integrated Next Day schedule.
 */
export function SchoolStatusCard({ onPress, showNextDay = true }: SchoolStatusCardProps) {
  const now = useNow(1000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  const assignments = useQuery({
    queryKey: qk.assignments,
    queryFn: () => fetchAssignments(),
    staleTime: 60_000,
  });

  const user = useAuthStore((state) => state.user);

  const bySubject = useMemo(() => {
    let raw = assignments.data ?? [];
    if (user?.created_at) {
      const userJoinTime = new Date(user.created_at).getTime();
      raw = raw.filter((item) => {
        const itemCreated = item.created_at ? new Date(item.created_at).getTime() : 0;
        const itemDue = item.due_date ? new Date(item.due_date).getTime() : 0;
        return itemCreated >= userJoinTime || itemDue >= userJoinTime;
      });
    }
    return groupBySubject(raw);
  }, [assignments.data, user?.created_at]);

  // The weekly timetable gives the live bell its subject name
  const day = dayForDate(new Date(now));
  const rows = day ? flattenDay(day) : [];
  const subjectAt = (index: number) => rows[index]?.subject ?? null;

  // Next school day calculation
  const { nextDay, isWeekend } = useMemo(() => {
    const current = dayForDate(new Date(now));
    if (!current) return { nextDay: TIMETABLE[0], isWeekend: true };
    const index = TIMETABLE.findIndex((entry) => entry.id === current.id);
    return { nextDay: TIMETABLE[(index + 1) % TIMETABLE.length], isWeekend: false };
  }, [now]);

  const isBreak = state.state === "break";
  const isClass = state.state === "class";
  const isAfter = state.state === "after";
  const isHoliday = state.state === "holiday";
  const isBefore = state.state === "before";

  // When countdown starts (before first bell, during classes, during breaks),
  // show TODAY's schedule until classes finish. Once classes are finished (after) or on weekends/holidays,
  // show NEXT DAY's schedule as before.
  const isCountdownActive = Boolean(day && (isBefore || isClass || isBreak));
  const displayDay = isCountdownActive && day ? day : nextDay;

  const displayRows = useMemo(() => {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    return flattenDay(displayDay)
      .filter((entry) => entry.subject)
      .map((entry) => {
        const list = (bySubject[entry.subject!.id] ?? []).filter(
          (item) => !item.is_completed_by_me
        );
        // Only include upcoming active events (never expired past tasks)
        const upcomingList = list.filter((item) => {
          if (!item.due_date) return true;
          const due = parseDue(item.due_date);
          return Boolean(due && due.getTime() >= startOfToday.getTime());
        });
        const exams = upcomingList.filter((item) => item.category === "exam");
        return {
          id: entry.subject!.id,
          subject: entry.subject!,
          label: entry.label,
          events: upcomingList,
          exam: exams.length > 0,
          tone: upcomingList.length ? dueTone(upcomingList[0].due_date) : ("none" as const),
        };
      });
  }, [bySubject, displayDay, now]);

  const totalEvents = displayRows.reduce((sum, row) => sum + row.events.length, 0);

  let accentColor: string = colors.white;
  let statusBadgeText = "وضعیت کلاس";
  let statusDotTone: string = colors.white;
  let gradientColors: string[] = ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.01)", "transparent"];
  let cornerTone = "rgba(255,255,255,0.20)";
  let cardBorderColor: string = colors.lineChip;

  if (isBreak) {
    accentColor = colors.success;
    statusBadgeText = "زنگ تفریح";
    statusDotTone = colors.success;
    gradientColors = ["rgba(52,211,153,0.18)", "rgba(16,185,129,0.03)", "transparent"];
    cornerTone = "rgba(52,211,153,0.35)";
    cardBorderColor = "rgba(52,211,153,0.30)";
  } else if (isClass) {
    accentColor = "#38bdf8";
    statusBadgeText = "در حال برگزاری کلاس";
    statusDotTone = "#38bdf8";
    gradientColors = ["rgba(56,189,248,0.15)", "rgba(14,165,233,0.02)", "transparent"];
    cornerTone = "rgba(56,189,248,0.35)";
    cardBorderColor = "rgba(56,189,248,0.25)";
  } else if (isBefore) {
    accentColor = colors.amber;
    statusBadgeText = "قبل از شروع مدرسه";
    statusDotTone = colors.amber;
    gradientColors = ["rgba(251,191,36,0.14)", "rgba(245,158,11,0.02)", "transparent"];
    cornerTone = "rgba(251,191,36,0.35)";
    cardBorderColor = "rgba(251,191,36,0.25)";
  } else if (isAfter) {
    accentColor = "#a78bfa";
    statusBadgeText = "پایان کلاس‌های امروز";
    statusDotTone = "#a78bfa";
    gradientColors = ["rgba(139,92,246,0.14)", "rgba(99,102,241,0.03)", "transparent"];
    cornerTone = "rgba(167,139,250,0.35)";
    cardBorderColor = "rgba(167,139,250,0.25)";
  } else if (isHoliday) {
    accentColor = "#c084fc";
    statusBadgeText = "تعطیلات آخر هفته";
    statusDotTone = "#c084fc";
    gradientColors = ["rgba(192,132,252,0.14)", "rgba(147,51,234,0.02)", "transparent"];
    cornerTone = "rgba(192,132,252,0.35)";
    cardBorderColor = "rgba(192,132,252,0.25)";
  }

  let title = "زنگ جاری";
  let detail = "";
  let countdownLabel = "";
  let remainingMs: number | null = null;
  let progress: number | null = null;
  let trackLeft = "";

  if (isClass) {
    const subject = subjectAt(state.bellIndex);
    title = subject ? `زنگ ${subject.name}` : state.bell.label;
    detail = subject?.teacher
      ? `${subject.teacher} · ${formatClock(state.bell.start)} تا ${formatClock(state.bell.end)}`
      : `${formatClock(state.bell.start)} تا ${formatClock(state.bell.end)}`;
    countdownLabel = "مانده به پایان زنگ";
    remainingMs = state.remainingMs;
    progress = state.progress;
    trackLeft = state.bell.label;
  } else if (isBreak) {
    const nextSubject = subjectAt(state.nextBellIndex);
    title = "زنگ تفریح و استراحت";
    detail = `زنگ بعد: ${nextSubject?.name ?? state.nextBell.label} · ساعت ${formatClock(state.nextBell.start)}`;
    countdownLabel = "مانده تا زنگ بعد";
    remainingMs = state.remainingMs;
    progress = state.progress;
    trackLeft = `${state.previousBell.label} → ${state.nextBell.label}`;
  } else if (isBefore) {
    const firstSubject = subjectAt(0);
    title = "تا شروع اولین زنگ";
    detail = `شروع ${formatClock(state.firstBell.start)} · ${firstSubject?.name ?? state.firstBell.label}`;
    countdownLabel = "مانده تا شروع";
    remainingMs = state.remainingMs;
  } else if (isHoliday) {
    title = "امروز مدرسه تعطیل است";
    detail = "فرصت مناسب برای مرور درس‌ها و استراحت";
  } else {
    // isAfter
    title = "کلاس‌های امروز به پایان رسید";
    detail = state.lastBell
      ? `پایان آخرین زنگ در ${formatClock(state.lastBell.end)} · خسته نباشید`
      : "برنامه درسی امروز تمام شد";
  }

  return (
    <Panel
      onPress={onPress}
      accessibilityLabel={isCountdownActive ? "وضعیت کلاس و برنامه امروز" : "وضعیت کلاس و برنامه روز بعد"}
      corners
      cornerTone={cornerTone}
      style={[styles.card, { borderColor: cardBorderColor }]}
      contentStyle={styles.content}
    >
      {/* Dynamic ambient glass glow */}
      <LinearGradient
        pointerEvents="none"
        colors={gradientColors as [string, string, ...string[]]}
        start={{ x: 0.9, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header Tag & Status Pill */}
      <View style={styles.topHeader}>
        <View style={styles.statusPill}>
          <PulseDot size={5} tone={statusDotTone} glow={isClass || isBreak} />
          <AppText color={accentColor} style={styles.statusPillText}>
            {statusBadgeText}
          </AppText>
        </View>
        <MonoLabel tone={colors.faint}>// CLASS STATUS</MonoLabel>
      </View>

      {/* Main Status Row */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <View
            style={[
              styles.iconTile,
              {
                borderColor: `${accentColor}40`,
                backgroundColor: `${accentColor}15`,
              },
            ]}
          >
            <Ionicons name={iconFor(state)} size={22} color={accentColor} />
          </View>

          <View style={styles.heroText}>
            <AppText numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
            <AppText numberOfLines={1} color={colors.textSoft} style={styles.detail}>
              {detail}
            </AppText>
          </View>
        </View>

        {remainingMs !== null ? (
          <View style={styles.countdown}>
            <AppText ltr color={accentColor} style={styles.countdownValue}>
              {clock(remainingMs)}
            </AppText>
            <AppText numberOfLines={1} color={colors.faint} style={styles.countdownLabel}>
              {countdownLabel}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Live Progress Bar */}
      {progress !== null ? (
        <View style={styles.progressWrap}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, Math.round(progress * 100))}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
          <View style={styles.trackMeta}>
            <AppText color={colors.faint} style={styles.trackText}>
              {trackLeft}
            </AppText>
            <AppText
              ltr
              color={accentColor}
              style={[styles.trackText, { fontVariant: ["tabular-nums"] }]}
            >
              {`${fmtNum(Math.max(0, Math.round(progress * 100)))}%`}
            </AppText>
          </View>
        </View>
      ) : null}

      {/* Integrated Schedule Section (Today's schedule during countdown/classes, Next Day's schedule after school finishes) */}
      {showNextDay ? (
        <View style={styles.nextDaySection}>
          <View style={styles.dividerLine} />

          <View style={styles.nextDayHeader}>
            <View style={styles.nextDayTitleRow}>
              <View style={styles.nextDayIconTile}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSoft} />
              </View>
              <View style={{ gap: 1 }}>
                <AppText style={styles.nextDayMainTitle}>
                  {isCountdownActive ? "برنامه امروز" : isWeekend ? "برنامه بعد از تعطیلات" : "برنامه روز بعد"}
                </AppText>
                <MonoLabel tone={colors.faint}>{`// ${isCountdownActive ? "TODAY" : "NEXT DAY"} · ${displayDay.name.toUpperCase()}`}</MonoLabel>
              </View>
            </View>

            <View style={styles.nextDayBadge}>
              <PulseDot size={5} tone={colors.white} glow={false} />
              <AppText color={colors.textSoft} style={styles.nextDayBadgeText}>
                {displayDay.name}
                {totalEvents > 0 ? ` · ${fmtNum(totalEvents)} رویداد` : ""}
              </AppText>
            </View>
          </View>

          {displayRows.length === 0 ? (
            <View style={styles.emptyNextBox}>
              <Ionicons name="moon-outline" size={22} color={colors.faint} />
              <AppText align="center" color={colors.faint} style={styles.emptyNextText}>
                {isCountdownActive ? "امروز کلاسی نداریم" : "روز بعد کلاسی نداریم"}
              </AppText>
            </View>
          ) : (
            <View style={styles.nextRowsList}>
              {displayRows.map((row, index) => {
                const isCurrentBell = isCountdownActive && isClass && state.bellIndex === index;
                const isNextBell = isCountdownActive && isBreak && state.nextBellIndex === index;

                return (
                  <View
                    key={`${row.id}-${index}`}
                    style={[
                      styles.nextRow,
                      row.events.length > 0 && { borderColor: TONE_BORDER[row.tone] },
                      isCurrentBell && { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}12` },
                      isNextBell && { borderColor: `${colors.success}60`, backgroundColor: `${colors.success}08` },
                    ]}
                  >
                    <View
                      style={[
                        styles.nextIconTile,
                        row.exam && {
                          borderColor: colors.dangerLine,
                          backgroundColor: colors.dangerSoft,
                        },
                        isCurrentBell && {
                          borderColor: `${accentColor}80`,
                          backgroundColor: `${accentColor}25`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={row.exam ? "school-outline" : isCurrentBell ? "flash-outline" : "book-outline"}
                        size={16}
                        color={row.exam ? colors.danger : isCurrentBell ? accentColor : colors.white}
                      />
                    </View>

                    <View style={styles.nextRowText}>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <AppText numberOfLines={1} style={styles.nextSubjectName}>
                          {row.subject.name}
                        </AppText>
                        {isCurrentBell ? (
                          <View style={styles.liveTag}>
                            <PulseDot size={4} tone={accentColor} glow />
                            <AppText color={accentColor} style={styles.liveTagText}>
                              در حال برگزاری
                            </AppText>
                          </View>
                        ) : isNextBell ? (
                          <View style={[styles.liveTag, { borderColor: `${colors.success}40`, backgroundColor: `${colors.success}15` }]}>
                            <PulseDot size={4} tone={colors.success} />
                            <AppText color={colors.success} style={styles.liveTagText}>
                              زنگ بعد
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText
                        numberOfLines={1}
                        color={colors.faint}
                        style={styles.nextSubjectDetail}
                      >
                        {row.subject.teacher} · {row.label}
                      </AppText>
                    </View>

                    {row.events.length > 0 ? (
                      <View
                        style={[
                          styles.nextChip,
                          {
                            borderColor: row.exam ? colors.dangerLine : colors.white12,
                            backgroundColor: row.exam ? colors.dangerSoft : colors.white04,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.eventDot,
                            {
                              backgroundColor: row.exam ? colors.danger : TONE_COLOR[row.tone],
                            },
                          ]}
                        />
                        <AppText
                          color={row.exam ? colors.danger : colors.textSoft}
                          style={styles.nextChipText}
                        >
                          {row.exam ? "امتحان" : "تکلیف"}
                        </AppText>
                        <AppText
                          ltr
                          color={row.exam ? colors.danger : colors.textSoft}
                          style={styles.nextChipNum}
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
        </View>
      ) : null}

      {/* Footer Navigation Link */}
      {onPress ? (
        <View style={styles.footer}>
          <AppText color={colors.faint} style={styles.footerText}>
            مشاهده برنامهٔ کامل هفتگی
          </AppText>
          <Ionicons name="chevron-back" size={14} color={colors.faint} />
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.panelPhone,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },

  /* Top Header */
  topHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  statusPillText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
  },

  /* Hero Row */
  heroRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 17.5,
    lineHeight: 25,
    color: colors.white,
  },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
  },

  /* Countdown */
  countdown: {
    alignItems: "flex-end",
    minWidth: 68,
  },
  countdownValue: {
    fontFamily: fonts.black,
    fontSize: 23,
    lineHeight: 29,
    fontVariant: ["tabular-nums"],
  },
  countdownLabel: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 14,
  },

  /* Progress Bar */
  progressWrap: {
    gap: 5,
    marginTop: 4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  trackMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },

  /* Next Day Section */
  nextDaySection: {
    marginTop: 6,
    gap: 10,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 4,
  },
  nextDayHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nextDayTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  nextDayIconTile: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  nextDayMainTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.white,
  },
  nextDayBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  nextDayBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fonts.medium,
  },

  /* Next Day Rows */
  nextRowsList: {
    gap: 7,
  },
  nextRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  nextIconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
  },
  nextRowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nextSubjectName: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.white,
  },
  nextSubjectDetail: {
    fontSize: 10.5,
    lineHeight: 15,
  },
  nextChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nextChipText: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    lineHeight: 13,
  },
  nextChipNum: {
    fontSize: 9.5,
    lineHeight: 13,
    fontVariant: ["tabular-nums"],
  },

  liveTag: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.40)",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  liveTagText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    lineHeight: 13,
  },

  /* Empty Box */
  emptyNextBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  emptyNextText: {
    fontSize: 11.5,
    lineHeight: 18,
  },

  /* Footer */
  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: 2,
    paddingTop: spacing.xs + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 16,
  },
});
