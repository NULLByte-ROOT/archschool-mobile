import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { fetchAssignments, qk } from "@/api/client";
import type { Assignment } from "@/api/types";
import { GlassCard } from "@/components/cards";
import { Header } from "@/components/Header";
import { SchoolStatusCard } from "@/components/SchoolStatusCard";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, leftMinutes, schoolEnd, schoolStart } from "@/lib/bell";
import { dueTone, fmtNum, parseDue } from "@/lib/format";
import {
  PERIOD_COUNT,
  TIMETABLE,
  flattenDay,
  type Day,
  type TimetableEntry,
} from "@/lib/timetable";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

const TONE_COLOR = {
  red: colors.red,
  amber: colors.amber,
  none: colors.faint,
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

function DayRow({
  day,
  entries,
  count,
  events,
  tone,
  open,
  bySubject,
  onToggle,
}: {
  day: Day;
  entries: TimetableEntry[];
  count: number;
  events: number;
  tone: "red" | "amber" | "none";
  open: boolean;
  bySubject: Record<string, Assignment[]>;
  onToggle: () => void;
}) {
  return (
    <View style={styles.dayWrap}>
      <View style={[styles.dayDot, open && styles.dayDotOpen]}>
        {open ? <View style={styles.dayDotInner} /> : null}
      </View>

      <Pressable
        onPress={onToggle}
        style={[styles.dayCard, open && styles.dayCardOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={day.name}
      >
        <View style={styles.dayBadge}>
          <AppText variant="strong" style={{ fontSize: 15 }}>
            {day.short}
          </AppText>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="strong">{day.name}</AppText>
          <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10.5 }}>
            {String(count).padStart(2, "0")} درس
          </AppText>
        </View>

        {events > 0 ? (
          <View style={styles.eventsPill}>
            <View style={[styles.eventDot, { backgroundColor: TONE_COLOR[tone] }]} />
            <AppText variant="caption" color={colors.textSoft} ltr style={{ fontSize: 10 }}>
              {fmtNum(events)}
            </AppText>
          </View>
        ) : null}

        <View style={[styles.chevron, open && { transform: [{ rotate: "180deg" }] }]}>
          <Ionicons name="chevron-down" size={15} color={colors.muted} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.entries}>
          {entries.length === 0 ? (
            <View style={styles.entryFree}>
              <View style={styles.entryIconDashed}>
                <Ionicons name="time-outline" size={15} color={colors.faint} />
              </View>
              <AppText variant="caption" color={colors.faint}>
                کلاسی برای این روز ثبت نشده
              </AppText>
            </View>
          ) : null}

          {entries.map((entry, index) => {
            if (!entry.subject) {
              return (
                <View key={`${day.id}-${index}`} style={styles.entryFree}>
                  <View style={styles.entryIconDashed}>
                    <Ionicons name="time-outline" size={15} color={colors.faint} />
                  </View>
                  <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
                    زنگ آزاد
                  </AppText>
                  <View style={styles.bellPill}>
                    <AppText variant="caption" color={colors.muted} style={{ fontSize: 10 }}>
                      {entry.label}
                    </AppText>
                  </View>
                </View>
              );
            }

            const related = bySubject[entry.subject.id] ?? [];
            const dotTone = related[0] ? dueTone(related[0].due_date) : "none";

            return (
              <View key={`${day.id}-${index}`} style={styles.entry}>
                <View style={styles.entryIcon}>
                  <Ionicons name="book-outline" size={15} color={colors.textSoft} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <AppText variant="label" numberOfLines={1}>
                    {entry.subject.name}
                  </AppText>
                  <AppText variant="caption" color={colors.faint} numberOfLines={1}>
                    {entry.subject.teacher}
                  </AppText>
                </View>
                {related.length ? (
                  <View style={[styles.eventDot, { backgroundColor: TONE_COLOR[dotTone] }]} />
                ) : null}
                <View style={styles.bellPill}>
                  <AppText variant="caption" color={colors.muted} style={{ fontSize: 10 }}>
                    {entry.label}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function TimetableScreen() {
  const router = useRouter();
  const now = useNow(15_000);
  const { bells, ready } = useBellSchedule();
  const state = getCurrentBellState(now, bells);
  const [openDay, setOpenDay] = useState<string | null>(TIMETABLE[0]?.id ?? null);

  const assignments = useQuery({
    queryKey: qk.assignments,
    queryFn: () => fetchAssignments(),
    staleTime: 60_000,
  });

  const bySubject = useMemo(
    () => groupBySubject(assignments.data ?? []),
    [assignments.data]
  );

  const days = useMemo(
    () =>
      TIMETABLE.map((day) => {
        const entries = flattenDay(day);
        let events = 0;
        let tone: "red" | "amber" | "none" = "none";

        for (const entry of entries) {
          if (!entry.subject) continue;
          const list = bySubject[entry.subject.id] ?? [];
          events += list.length;
          if (list.length) {
            const t = dueTone(list[0].due_date);
            if (t === "red") tone = "red";
            else if (t === "amber" && tone === "none") tone = "amber";
          }
        }

        return {
          day,
          entries,
          count: entries.filter((entry) => entry.subject).length,
          events,
          tone,
        };
      }),
    [bySubject]
  );

  return (
    <Screen edges={["top", "bottom"]}>
      <Header
        title="برنامه هفتگی"
        subtitle={
          ready
            ? `شنبه تا چهارشنبه · ${formatClock(schoolStart(bells))} تا ${formatClock(
                schoolEnd(bells)
              )}`
            : "در حال هم‌گام‌سازی با سرور…"
        }
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SchoolStatusCard />

        <GlassCard contentStyle={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.headIcon}>
              <Ionicons name="calendar-outline" size={17} color={colors.text} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <AppText variant="subtitle">جدول کلاس‌ها</AppText>
              <AppText
                variant="caption"
                color={colors.faint}
                ltr
                style={{ fontFamily: fonts.medium, fontSize: 9.5, letterSpacing: 1.6 }}
              >
                // CLASS TIMETABLE
              </AppText>
            </View>
            <View style={styles.countPill}>
              <AppText variant="caption" color={colors.muted} style={{ fontSize: 10 }}>
                {fmtNum(bells.length)} زنگ
              </AppText>
            </View>
          </View>

          <View style={styles.timeline}>
            <View style={styles.timelineLine} pointerEvents="none" />
            {days.map(({ day, entries, count, events, tone }) => (
              <DayRow
                key={day.id}
                day={day}
                entries={entries}
                count={count}
                events={events}
                tone={tone}
                open={openDay === day.id}
                bySubject={bySubject}
                onToggle={() =>
                  setOpenDay((current) => (current === day.id ? null : day.id))
                }
              />
            ))}
          </View>

          <AppText variant="caption" color={colors.faint} align="center">
            روی هر روز بزن تا درس‌هایش باز شود.
          </AppText>
        </GlassCard>

        <GlassCard contentStyle={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.headIcon}>
              <Ionicons name="time-outline" size={17} color={colors.text} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <AppText variant="subtitle">زنگ‌های امروز</AppText>
              <AppText variant="caption" color={colors.muted}>
                زمان‌ها مستقیم از تنظیمات ادمین خوانده می‌شوند.
              </AppText>
            </View>
          </View>

          <View style={styles.list}>
            {bells.map((bell, index) => {
              const active = state.state === "class" && state.bellIndex === index;
              const next = bells[index + 1];
              const gap = next ? next.start - bell.end : 0;

              return (
                <View key={bell.number}>
                  <View style={[styles.row, active && styles.rowActive]}>
                    <View
                      style={[
                        styles.badge,
                        active && {
                          backgroundColor: colors.amberSoft,
                          borderColor: colors.amberLine,
                        },
                      ]}
                    >
                      <AppText
                        variant="numberSm"
                        color={active ? colors.amber : colors.muted}
                        ltr
                        style={{ fontFamily: fonts.bold, fontSize: 14 }}
                      >
                        {fmtNum(bell.number)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText variant="strong">{bell.label}</AppText>
                      <AppText
                        variant="caption"
                        color={active ? colors.amber : colors.faint}
                        ltr
                        style={{ fontFamily: fonts.medium }}
                      >
                        {formatClock(bell.start)} — {formatClock(bell.end)}
                      </AppText>
                    </View>
                    {active ? (
                      <AppText variant="caption" color={colors.amber}>
                        {fmtNum(leftMinutes(state.remainingMs))} دقیقه مانده
                      </AppText>
                    ) : (
                      <AppText variant="caption" color={colors.faint}>
                        {fmtNum(bell.end - bell.start)} دقیقه
                      </AppText>
                    )}
                  </View>

                  {gap > 0 ? (
                    <View style={styles.breakRow}>
                      <View style={styles.breakIcon}>
                        <Ionicons name="cafe-outline" size={14} color={colors.teal} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <AppText
                          variant="label"
                          color={colors.teal}
                          style={{ fontFamily: fonts.semibold }}
                        >
                          زنگ تفریح
                        </AppText>
                        <AppText variant="caption" color={colors.faint} ltr>
                          {formatClock(bell.end)} — {formatClock(next.start)}
                        </AppText>
                      </View>
                      <AppText variant="caption" color={colors.teal}>
                        {fmtNum(gap)} دقیقه
                      </AppText>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </GlassCard>

        <AppText
          variant="caption"
          color={colors.faint}
          align="center"
          style={{ marginTop: spacing.sm }}
        >
          {PERIOD_COUNT} زنگ در برنامهٔ هفتگی · با هر بار باز کردن این صفحه، زمان‌ها دوباره از سرور
          خوانده می‌شوند.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
    paddingBottom: 120,
    gap: spacing.md,
  },
  card: { padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  timeline: { gap: 8 },
  timelineLine: {
    position: "absolute",
    top: 22,
    bottom: 22,
    right: 14,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dayWrap: { paddingRight: 34 },
  dayDot: {
    position: "absolute",
    right: 8,
    top: 17,
    zIndex: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotOpen: { borderColor: colors.white, backgroundColor: colors.white },
  dayDotInner: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.black,
  },
  dayCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(12,12,16,0.82)",
  },
  dayCardOpen: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  eventsPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  eventDot: { width: 7, height: 7, borderRadius: 4 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  entries: { gap: 8, paddingTop: 8 },
  entry: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  entryFree: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.10)",
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  entryIconDashed: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.10)",
  },
  bellPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  list: { gap: 8 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  rowActive: {
    borderColor: colors.amberLine,
    backgroundColor: "rgba(242,180,85,0.08)",
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  breakRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: 4,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(79,209,181,0.22)",
    backgroundColor: "rgba(79,209,181,0.05)",
  },
  breakIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealSoft,
  },
});
