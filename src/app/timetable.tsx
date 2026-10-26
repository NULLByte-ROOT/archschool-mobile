import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchAssignments, qk } from "@/api/client";
import type { Assignment } from "@/api/types";
import { SchoolStatusCard } from "@/components/SchoolStatusCard";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { IconTile, Kicker, Panel, PanelHeader, PulseDot } from "@/components/webui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, leftMinutes, schoolEnd, schoolStart } from "@/lib/bell";
import { faDate, fmtNum, parseDue } from "@/lib/format";
import {
  TIMETABLE,
  dayForDate,
  flattenDay,
  type Day,
  type TimetableEntry,
} from "@/lib/timetable";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const TONE_COLOR = {
  red: colors.red,
  amber: colors.amber,
  none: "rgba(255,255,255,0.35)",
} as const;

const TONE_BORDER = {
  red: "rgba(248,113,113,0.35)",
  amber: "rgba(251,191,36,0.30)",
  none: colors.white10,
} as const;

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

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
  if (diff <= 86_400_000) return "red";
  if (diff <= 86_400_000 * 2) return "amber";
  return "none";
}

/** The web header's ticking clock badge (`LiveClock`). */
function LiveClock() {
  const now = useNow(1000);
  return (
    <View style={styles.clockBadge}>
      <Ionicons name="time-outline" size={11} color={colors.textSoft} />
      <AppText
        ltr
        color={colors.textSoft}
        style={{
          fontFamily: fonts.medium,
          fontSize: 11,
          lineHeight: 16,
          letterSpacing: 0.6,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatClock(new Date(now).getHours() * 60 + new Date(now).getMinutes())}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* weekly accordion                                                   */
/* ------------------------------------------------------------------ */

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
          <AppText style={{ fontFamily: fonts.black, fontSize: 15, lineHeight: 22 }}>
            {day.short}
          </AppText>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20 }}>
            {day.name}
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 15 }}>
            {fmtNum(count)} درس
          </AppText>
        </View>

        {events > 0 ? (
          <View style={styles.eventsPill}>
            <View style={[styles.eventDot, { backgroundColor: TONE_COLOR[tone] }]} />
            <AppText ltr color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
              {fmtNum(events)}
            </AppText>
          </View>
        ) : null}

        <View style={[styles.chevron, open && { transform: [{ rotate: "180deg" }] }]}>
          <Ionicons name="chevron-down" size={15} color={colors.faint} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.entries}>
          {entries.length === 0 ? (
            <View style={styles.entryFree}>
              <View style={styles.entryIconDashed}>
                <Ionicons name="time-outline" size={15} color={colors.faint} />
              </View>
              <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 17 }}>
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
                  <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 17, flex: 1 }}>
                    زنگ آزاد
                  </AppText>
                  <View style={styles.bellPill}>
                    <AppText color={colors.muted} style={{ fontSize: 10, lineHeight: 14 }}>
                      {entry.label}
                    </AppText>
                  </View>
                </View>
              );
            }

            const related = (bySubject[entry.subject.id] ?? []).filter(
              (item) => !item.is_completed_by_me
            );
            const dotTone = related[0] ? dueTone(related[0].due_date) : "none";

            return (
              <View key={`${day.id}-${index}`} style={styles.entry}>
                <View style={styles.entryIcon}>
                  <Ionicons name="book-outline" size={15} color={colors.textSoft} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <AppText
                    numberOfLines={1}
                    style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 18 }}
                  >
                    {entry.subject.name}
                  </AppText>
                  <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 10.5, lineHeight: 15 }}>
                    {entry.subject.teacher}
                  </AppText>
                </View>
                {related.length ? (
                  <View style={styles.eventsPill}>
                    <View style={[styles.eventDot, { backgroundColor: TONE_COLOR[dotTone] }]} />
                    <AppText ltr color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
                      {fmtNum(related.length)}
                    </AppText>
                  </View>
                ) : null}
                <View style={styles.bellPill}>
                  <AppText color={colors.muted} style={{ fontSize: 10, lineHeight: 14 }}>
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

/* ------------------------------------------------------------------ */
/* next school day                                                    */
/* ------------------------------------------------------------------ */

function NextDayPanel({
  bySubject,
  now,
}: {
  bySubject: Record<string, Assignment[]>;
  now: number;
}) {
  const { day, isWeekend } = useMemo(() => {
    const current = dayForDate(new Date(now));
    if (!current) return { day: TIMETABLE[0], isWeekend: true };
    const index = TIMETABLE.findIndex((entry) => entry.id === current.id);
    return { day: TIMETABLE[(index + 1) % TIMETABLE.length], isWeekend: false };
  }, [now]);

  const rows = useMemo(() => {
    return flattenDay(day)
      .filter((entry) => entry.subject)
      .map((entry) => {
        const list = (bySubject[entry.subject!.id] ?? []).filter(
          (item) => !item.is_completed_by_me
        );
        const exams = list.filter((item) => item.category === "exam");
        return {
          id: entry.subject!.id,
          subject: entry.subject!,
          label: entry.label,
          events: list,
          exam: exams.length > 0,
          tone: list.length ? dueTone(list[0].due_date) : ("none" as const),
        };
      });
  }, [bySubject, day]);

  const totalEvents = rows.reduce((sum, row) => sum + row.events.length, 0);

  return (
    <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
      <PanelHeader
        label={`// NEXT DAY · ${day.name.toUpperCase()}`}
        title={isWeekend ? "برنامه بعد از تعطیلات" : "برنامه روز بعد"}
        icon="calendar"
        accessory={
          <View style={styles.badge}>
            <PulseDot size={5} tone={colors.white} glow={false} />
            <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
              {day.name}
              {totalEvents > 0 ? ` · ${fmtNum(totalEvents)} رویداد` : ""}
            </AppText>
          </View>
        }
      />

      {rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="moon-outline" size={24} color={colors.faint} />
          <AppText align="center" color={colors.faint} style={{ fontSize: 12, lineHeight: 20 }}>
            روز بعد کلاسی نداریم
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((row) => (
            <View
              key={row.id}
              style={[
                styles.nextRow,
                row.events.length > 0 && { borderColor: TONE_BORDER[row.tone] },
              ]}
            >
              <View style={styles.nextIcon}>
                <Ionicons
                  name={row.exam ? "school-outline" : "book-outline"}
                  size={17}
                  color={colors.white}
                />
              </View>

              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <AppText
                  numberOfLines={1}
                  style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 18 }}
                >
                  {row.subject.name}
                </AppText>
                <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 10.5, lineHeight: 15 }}>
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
                      { backgroundColor: row.exam ? colors.danger : TONE_COLOR[row.tone] },
                    ]}
                  />
                  <AppText
                    color={row.exam ? colors.danger : colors.textSoft}
                    style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 14 }}
                  >
                    {row.exam ? "امتحان" : "تکلیف"}
                  </AppText>
                  <AppText
                    ltr
                    color={row.exam ? colors.danger : colors.textSoft}
                    style={{ fontSize: 10, lineHeight: 14, fontVariant: ["tabular-nums"] }}
                  >
                    {fmtNum(row.events.length)}
                  </AppText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* screen                                                             */
/* ------------------------------------------------------------------ */

export default function TimetableScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);
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
          const list = (bySubject[entry.subject.id] ?? []).filter(
            (item) => !item.is_completed_by_me
          );
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

  const shadow = new Date(now);
  const today = DAY_NAMES[shadow.getDay() === 6 ? 0 : (shadow.getDay() + 1) % 7];

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(tabBarReserve, 40) + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* header */}
        <Animated.View entering={FadeInDown.duration(320)} style={{ marginBottom: 16 }}>
          <Kicker text="timetable" dot style={{ marginBottom: 10 }} />

          <View style={styles.headerRow}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="بازگشت"
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-forward" size={15} color={colors.textSoft} />
                </Pressable>
                <AppText
                  style={{
                    fontFamily: fonts.black,
                    fontSize: 24,
                    lineHeight: 33,
                    letterSpacing: -0.4,
                  }}
                >
                  برنامه هفتگی
                </AppText>
              </View>

              <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
                {ready
                  ? `شنبه تا چهارشنبه · ${formatClock(schoolStart(bells))} تا ${formatClock(
                      schoolEnd(bells)
                    )} · امروز ${today} ${faDate(now, "dayMonth")}`
                  : "در حال هم‌گام‌سازی با سرور…"}
              </AppText>
            </View>

            <LiveClock />
          </View>
        </Animated.View>

        {/* current period */}
        <Animated.View entering={FadeInDown.duration(320).delay(20)} style={{ marginBottom: 16 }}>
          <SchoolStatusCard />
        </Animated.View>

        {/* weekly timetable */}
        <Animated.View entering={FadeInDown.duration(360).delay(40)} style={{ marginBottom: 16 }}>
          <Panel corners contentStyle={styles.panelPad}>
            <PanelHeader
              label="// CLASS TIMETABLE · YAZDAHOM NETWORK 1"
              title="جدول کلاس‌ها"
              icon="calendar"
              accessory={
                <View style={styles.badge}>
                  <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
                    {fmtNum(bells.length)} زنگ · {formatClock(schoolStart(bells))}–
                    {formatClock(schoolEnd(bells))}
                  </AppText>
                </View>
              }
            />

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

            <AppText
              align="center"
              color={colors.faint}
              style={{ fontSize: 10.5, lineHeight: 16, marginTop: 12 }}
            >
              روی هر روز بزن تا درس‌هایش باز شود.
            </AppText>
          </Panel>
        </Animated.View>

        {/* bells */}
        <Animated.View entering={FadeInDown.duration(360).delay(60)} style={{ marginBottom: 16 }}>
          <Panel corners contentStyle={styles.panelPad}>
            <PanelHeader
              label="// BELLS"
              title="زنگ‌های امروز"
              icon="time"
              accessory={
                <IconTile name="alarm-outline" size={32} iconSize={15} tone={colors.textSoft} />
              }
            />

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
                          styles.badgeSquare,
                          active && {
                            backgroundColor: colors.amberSoft,
                            borderColor: colors.amberLine,
                          },
                        ]}
                      >
                        <AppText
                          ltr
                          color={active ? colors.amber : colors.muted}
                          style={{
                            fontFamily: fonts.bold,
                            fontSize: 14,
                            lineHeight: 20,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {fmtNum(bell.number)}
                        </AppText>
                      </View>

                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <AppText
                          style={{ fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18 }}
                        >
                          {bell.label}
                        </AppText>
                        <AppText
                          ltr
                          color={active ? colors.amber : colors.faint}
                          style={{ fontSize: 10.5, lineHeight: 15, fontVariant: ["tabular-nums"] }}
                        >
                          {formatClock(bell.start)} — {formatClock(bell.end)}
                        </AppText>
                      </View>

                      {active ? (
                        <AppText color={colors.amber} style={{ fontSize: 10.5, lineHeight: 15 }}>
                          {fmtNum(leftMinutes(state.remainingMs))} دقیقه مانده
                        </AppText>
                      ) : (
                        <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 15 }}>
                          {fmtNum(bell.end - bell.start)} دقیقه
                        </AppText>
                      )}
                    </View>

                    {gap > 0 ? (
                      <View style={styles.breakRow}>
                        <View style={styles.breakIcon}>
                          <Ionicons name="cafe-outline" size={14} color={colors.success} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                          <AppText
                            color="#a7f3d0"
                            style={{ fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 17 }}
                          >
                            زنگ تفریح
                          </AppText>
                          <AppText
                            ltr
                            color={colors.faint}
                            style={{ fontSize: 10, lineHeight: 15, fontVariant: ["tabular-nums"] }}
                          >
                            {formatClock(bell.end)} — {formatClock(next.start)}
                          </AppText>
                        </View>
                        <AppText color="#a7f3d0" style={{ fontSize: 10.5, lineHeight: 15 }}>
                          {fmtNum(gap)} دقیقه
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Panel>
        </Animated.View>

        {/* next day */}
        <Animated.View entering={FadeInDown.duration(360).delay(80)}>
          <NextDayPanel bySubject={bySubject} now={now} />

          <AppText
            align="center"
            color={colors.faint}
            style={{ fontSize: 10.5, lineHeight: 16, paddingHorizontal: 8 }}
          >
            {fmtNum(bells.length)} زنگ در برنامهٔ هفتگی · با هر بار باز کردن این صفحه، زمان‌ها دوباره
            از سرور خوانده می‌شوند.
          </AppText>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
  },

  /* header */
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  clockBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },

  /* panels */
  panelPad: { padding: 16 },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  /* timeline */
  timeline: { gap: 8 },
  timelineLine: {
    position: "absolute",
    top: 22,
    bottom: 22,
    right: 14,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
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
    borderColor: "rgba(255,255,255,0.40)",
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
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white08,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  dayCardOpen: {
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: colors.white05,
  },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: colors.white06,
  },
  eventsPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: colors.white05,
  },
  eventDot: { width: 7, height: 7, borderRadius: 4 },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  entries: { gap: 8, paddingTop: 8 },
  entry: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  entryFree: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white10,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white05,
  },
  entryIconDashed: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white10,
  },
  bellPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
  },

  /* bells list */
  list: { gap: 8 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rowActive: {
    borderColor: colors.amberLine,
    backgroundColor: "rgba(251,191,36,0.07)",
  },
  badgeSquare: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white04,
  },
  breakRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
    marginHorizontal: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.successLine,
    backgroundColor: colors.successSoft,
  },
  breakIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,211,153,0.16)",
  },

  /* next day */
  nextRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  nextIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white05,
  },
  nextChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white12,
  },
});
