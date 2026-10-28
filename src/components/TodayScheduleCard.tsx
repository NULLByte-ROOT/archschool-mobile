import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { IconTile, MonoLabel, Panel, PulseDot } from "@/components/webui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, schoolEnd, type Bell } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { SUBJECT_BY_ID, type Subject } from "@/lib/subjects";
import { PERIOD_COUNT, scheduleTarget, type Day } from "@/lib/timetable";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

interface Block {
  key: string;
  subject: Subject | null;
  label: string;
  /** Minute-of-day the block starts / ends, taken from the admin's bells. */
  start: number;
  end: number;
  firstPeriod: number;
  span: number;
}

/**
 * Collapses a day into *subject blocks*, not bells. A `span: 4` workshop is one
 * row covering the whole day (exactly like the web's `dayEntries`), so it is
 * never repeated four times.
 */
function dayBlocks(day: Day | undefined, bells: Bell[]): Block[] {
  if (!day || bells.length === 0) return [];
  const out: Block[] = [];
  let period = 0;
  day.cells.forEach((cell, cellIndex) => {
    const firstPeriod = period;
    period += cell.span;
    const lastPeriod = Math.min(firstPeriod + cell.span, bells.length) - 1;
    if (lastPeriod < firstPeriod) return;
    const span = lastPeriod - firstPeriod + 1;
    out.push({
      key: `${cellIndex}-${firstPeriod}`,
      subject:
        cell.kind === "class" ? SUBJECT_BY_ID[cell.subjectId] ?? null : null,
      label:
        span >= PERIOD_COUNT
          ? "تمام زنگ‌ها"
          : span > 1
            ? `زنگ ${fmtNum(firstPeriod + 1)} تا ${fmtNum(lastPeriod + 1)}`
            : `زنگ ${fmtNum(firstPeriod + 1)}`,
      start: bells[firstPeriod].start,
      end: bells[lastPeriod].end,
      firstPeriod,
      span,
    });
  });
  return out;
}

/**
 * «برنامهٔ امروز / روز بعد» — mirrors the web's `scheduleTarget` logic:
 *
 * - one row per subject block (span-aware, never repeated),
 * - after the last bell the card switches to the next school day,
 * - Friday (or Thursday) jumps straight to Saturday,
 * - the live bell is «الان» and the upcoming block is «بعدی».
 */
export function TodayScheduleCard({ onPress }: { onPress?: () => void }) {
  const now = useNow(15_000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);
  // بعد از پایان آخرین زنگ، کارت «برنامهٔ امروز» کاملاً پنهان می‌شود و
  // نیمه‌شبِ بعد (وقتی وضعیت به «before» برمی‌گردد) دوباره ظاهر می‌شود.
  const schoolOver = state.state === "after";
  const target = scheduleTarget(now, schoolEnd(bells));
  const day = target.day;
  const blocks = dayBlocks(day, bells);

  const today = new Date(now);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const showToday = !target.isTomorrow;
  const activeIndex =
    showToday && state.state === "class" ? state.bellIndex : -1;
  const nextBlock = showToday
    ? blocks.find((block) => block.start > nowMinutes)
    : undefined;

  const title = !target.isTomorrow
    ? "برنامهٔ امروز"
    : target.isLiteralTomorrow
      ? "برنامهٔ فردا"
      : "برنامهٔ بعد از تعطیلات";

  const badge = !target.isTomorrow
    ? "امروز"
    : target.isLiteralTomorrow
      ? "فردا"
      : "روز بعد";

  if (schoolOver) return null;

  return (
    <Panel
      corners
      onPress={onPress}
      accessibilityLabel={title}
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
              {title}
            </AppText>
            <MonoLabel>
              {`// ${target.isTomorrow ? "TOMORROW" : "TODAY"}${day ? ` · ${day.name}` : ""}`}
            </MonoLabel>
          </View>
        </View>

        <View style={st.todayBadge}>
          <PulseDot size={5} glow={false} />
          <AppText
            color={colors.textSoft}
            style={{ fontFamily: fonts.medium, fontSize: 10, lineHeight: 14 }}
          >
            {badge}
          </AppText>
        </View>
      </View>

      {target.isWeekend ? (
        <View style={st.holiday}>
          <Ionicons name="moon" size={15} color={colors.textSoft} />
          <AppText color={colors.textSoft} style={st.finishedText}>
            امروز تعطیله — برنامهٔ روز بعد
          </AppText>
        </View>
      ) : target.isAfterSchool ? (
        <View style={st.finished}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <AppText color={colors.emeraldPale} style={st.finishedText}>
            کلاس‌های امروز تموم شد
          </AppText>
        </View>
      ) : null}

      {!day || blocks.length === 0 ? (
        <View style={st.empty}>
          <Ionicons name="moon" size={26} color={colors.faint} />
          <AppText align="center" color={colors.textSoft} style={st.emptyText}>
            {target.isWeekend ? "تعطیلات آخر هفته" : "کلاسی نداریم"}
          </AppText>
          <AppText align="center" color={colors.faint} style={st.emptyHint}>
            برنامهٔ هفتگی را در تب «برنامه» ببین
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.xs + 2 }}>
          {blocks.map((block) => {
            const name = block.subject?.name ?? "زنگ آزاد";
            const isNow =
              activeIndex >= block.firstPeriod &&
              activeIndex < block.firstPeriod + block.span;
            const isNext = !isNow && nextBlock?.key === block.key;
            const isPast = showToday && block.end <= nowMinutes && !isNow;

            return (
              <View
                key={block.key}
                style={[
                  st.row,
                  isNow ? st.rowNow : isNext ? st.rowNext : null,
                  isPast ? st.rowPast : null,
                ]}
              >
                <View style={[st.chip, isNow ? st.chipNow : null]}>
                  <AppText
                    ltr
                    color={isNow ? colors.onAccent : colors.faint}
                    style={st.chipText}
                  >
                    {block.span > 1
                      ? `${fmtNum(block.firstPeriod + 1)}–${fmtNum(block.firstPeriod + block.span)}`
                      : fmtNum(block.firstPeriod + 1)}
                  </AppText>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    numberOfLines={1}
                    color={isPast ? colors.muted : colors.text}
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
                    {`${formatClock(block.start)} – ${formatClock(block.end)}`}
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
                ) : (
                  <AppText color={colors.faint} style={st.spanText}>
                    {block.label}
                  </AppText>
                )}
              </View>
            );
          })}
        </View>
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

  holiday: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: colors.white03,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: spacing.xs + 2,
  },

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
    minWidth: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  chipNow: { borderColor: colors.white, backgroundColor: colors.white },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
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
  spanText: { fontFamily: fonts.medium, fontSize: 9.5, lineHeight: 14 },
});
