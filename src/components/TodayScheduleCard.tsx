import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { IconTile, MonoLabel, Panel, PulseDot } from "@/components/webui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { SUBJECT_BY_ID, type Subject } from "@/lib/subjects";
import { dayForDate, type Day } from "@/lib/timetable";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/**
 * The timetable row for one bell. Unlike `flattenDay`, a `span: 4` cell (e.g.
 * Saturday's workshop) answers for every bell it covers, so bell 2/3/4 do not
 * fall back to «زنگ ۲» when the class actually continues.
 */
function periodAt(
  day: Day | undefined,
  index: number
): { subject: Subject | null; covered: boolean } {
  if (!day) return { subject: null, covered: false };
  let period = 0;
  for (const cell of day.cells) {
    if (index >= period && index < period + cell.span) {
      return {
        subject: cell.kind === "class" ? SUBJECT_BY_ID[cell.subjectId] ?? null : null,
        covered: true,
      };
    }
    period += cell.span;
  }
  return { subject: null, covered: false };
}

/**
 * «برنامهٔ امروز» — today's bells only, in order, with the live one marked.
 *
 * States mirror `SchoolStatusCard`: before school the first bell is «بعدی»,
 * during a bell that bell is «الان», during a break the following bell is
 * «بعدی», after the last bell a «کلاس‌های امروز تموم شد» banner appears, and
 * Friday (or any non-school day) collapses to «امروز تعطیله».
 */
export function TodayScheduleCard({ onPress }: { onPress?: () => void }) {
  const now = useNow(15_000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  const today = new Date(now);
  const day = dayForDate(today);
  const holiday = state.state === "holiday" || !day;

  const currentIndex = state.state === "class" ? state.bellIndex : -1;
  const nextIndex =
    state.state === "break"
      ? state.nextBellIndex
      : state.state === "before"
        ? 0
        : -1;
  const finished = state.state === "after";

  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  return (
    <Panel
      corners
      onPress={onPress}
      accessibilityLabel="برنامهٔ امروز"
      contentStyle={st.content}
    >
      <View style={st.header}>
        <View style={st.headerRight}>
          <IconTile
            name="calendar-clear-outline"
            size={40}
            iconSize={18}
            tone={colors.white}
            border={colors.white15}
          />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <AppText
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}
            >
              برنامهٔ امروز
            </AppText>
            <MonoLabel>{`// TODAY${day ? ` · ${day.name}` : ""}`}</MonoLabel>
          </View>
        </View>

        <View style={st.todayBadge}>
          <PulseDot size={5} glow={false} />
          <AppText
            color={colors.textSoft}
            style={{ fontFamily: fonts.medium, fontSize: 10, lineHeight: 14 }}
          >
            امروز
          </AppText>
        </View>
      </View>

      {holiday ? (
        <View style={st.empty}>
          <Ionicons name="moon" size={26} color={colors.faint} />
          <AppText align="center" color={colors.textSoft} style={st.emptyText}>
            امروز تعطیله
          </AppText>
          <AppText align="center" color={colors.faint} style={st.emptyHint}>
            برنامهٔ هفتگی را در تب «برنامه» ببین
          </AppText>
        </View>
      ) : (
        <>
          {finished ? (
            <View style={st.finished}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText color={colors.emeraldPale} style={st.finishedText}>
                کلاس‌های امروز تموم شد
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: spacing.xs + 2 }}>
            {bells.map((bell, index) => {
              const slot = periodAt(day, index);
              const name = slot.covered
                ? slot.subject?.name ?? "زنگ آزاد"
                : bell.label;
              const isNow = index === currentIndex;
              const isNext = index === nextIndex && !isNow;
              const isPast = finished || bell.end <= nowMinutes;

              return (
                <View
                  key={`${bell.number}-${bell.start}`}
                  style={[
                    st.row,
                    isNow ? st.rowNow : isNext ? st.rowNext : null,
                    isPast && !isNow ? st.rowPast : null,
                  ]}
                >
                  <View style={[st.chip, isNow ? st.chipNow : null]}>
                    <AppText
                      ltr
                      color={isNow ? colors.onAccent : colors.faint}
                      style={st.chipText}
                    >
                      {fmtNum(bell.number)}
                    </AppText>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText
                      numberOfLines={1}
                      color={isPast && !isNow ? colors.muted : colors.text}
                      style={{
                        fontFamily: isNow ? fonts.bold : fonts.semibold,
                        fontSize: 13.5,
                        lineHeight: 20,
                      }}
                    >
                      {name}
                    </AppText>
                    <AppText
                      ltr
                      color={isNow ? colors.textSoft : colors.faint}
                      style={st.time}
                    >
                      {`${formatClock(bell.start)} – ${formatClock(bell.end)}`}
                    </AppText>
                  </View>

                  {isNow ? (
                    <View style={st.nowPill}>
                      <AppText color={colors.onAccent} style={st.nowText}>
                        الان
                      </AppText>
                    </View>
                  ) : isNext ? (
                    <View style={st.nextPill}>
                      <PulseDot size={5} tone={colors.textSoft} glow={false} />
                      <AppText color={colors.textSoft} style={st.nextText}>
                        بعدی
                      </AppText>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      )}
    </Panel>
  );
}

const st = StyleSheet.create({
  content: { padding: 16 },
  header: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  headerRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  todayBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.white12,
    paddingVertical: 34,
    paddingHorizontal: spacing.lg,
  },
  emptyText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21 },
  emptyHint: { fontSize: 10.5, lineHeight: 16 },

  finished: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.successLine,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: spacing.xs + 2,
  },
  finishedText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 },

  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  rowNow: {
    borderColor: colors.white18,
    backgroundColor: colors.white06,
  },
  rowNext: {
    borderColor: colors.lineChip,
    backgroundColor: colors.white03,
  },
  rowPast: { opacity: 0.5 },

  chip: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  chipNow: { borderColor: colors.white, backgroundColor: colors.white },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
  },

  time: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },

  nowPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  nowText: { fontFamily: fonts.bold, fontSize: 9.5, lineHeight: 14 },
  nextPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineChip,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nextText: { fontFamily: fonts.medium, fontSize: 9.5, lineHeight: 14 },
});
