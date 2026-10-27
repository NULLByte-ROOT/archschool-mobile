import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { MonoLabel, Panel } from "@/components/webui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, type CurrentBellState } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { dayForDate, flattenDay } from "@/lib/timetable";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** `MM:SS` (or `H:MM:SS`) — Latin digits, tabular, like the web countdown. */
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
  return "calendar-outline";
}

/**
 * «وضعیت کلاس» — the mobile mirror of the web's `CurrentPeriodCard`.
 *
 * Everything is derived from the bells the admin saved (`useBellSchedule`); no
 * clock time is hard-coded here. The one-second tick lives *inside* this
 * component so a live countdown never re-renders the dashboard around it.
 *
 * States: class → subject + teacher + bell range + «مانده به پایان زنگ»;
 * break → «زنگ تفریح» + next bell + «مانده تا زنگ بعد»; before → «مدرسه هنوز
 * شروع نشده»; holiday → «امروز تعطیل است»; after → «کلاس‌ها تمام شد».
 */
export function SchoolStatusCard({ onPress }: { onPress?: () => void }) {
  const now = useNow(1000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  // The weekly timetable gives the live bell its subject name (the schedule API
  // only knows bell numbers).
  const day = dayForDate(new Date(now));
  const rows = day ? flattenDay(day) : [];
  const subjectAt = (index: number) => rows[index]?.subject ?? null;

  const isBreak = state.state === "break";
  const tone = isBreak ? colors.success : colors.white;
  const softTone = isBreak ? "#a7f3d0" : colors.textSoft;
  const faintTone = isBreak ? "rgba(167,243,208,0.62)" : colors.faint;

  let title = "زنگ جاری";
  let detail = "";
  let countdownLabel = "";
  let remainingMs: number | null = null;
  let progress: number | null = null;
  /** Right-hand caption under the progress bar («زنگ ۱» or «زنگ ۱ → زنگ ۲»). */
  let trackLeft = "";

  if (state.state === "class") {
    const subject = subjectAt(state.bellIndex);
    // `bell.label` is already «زنگ ۲», so only prefix the subject name.
    title = subject ? `زنگ ${subject.name}` : state.bell.label;
    detail = subject?.teacher
      ? `${subject.teacher} · ${formatClock(state.bell.start)}–${formatClock(
          state.bell.end
        )}`
      : `${formatClock(state.bell.start)}–${formatClock(state.bell.end)}`;
    countdownLabel = "مانده به پایان زنگ";
    remainingMs = state.remainingMs;
    progress = state.progress;
    trackLeft = state.bell.label;
  } else if (state.state === "break") {
    const nextSubject = subjectAt(state.nextBellIndex);
    title = "زنگ تفریح";
    detail = `زنگ بعد: ${nextSubject?.name ?? state.nextBell.label} · ${formatClock(
      state.nextBell.start
    )}`;
    countdownLabel = "مانده تا زنگ بعد";
    remainingMs = state.remainingMs;
    progress = state.progress;
    trackLeft = `${state.previousBell.label} → ${state.nextBell.label}`;
  } else if (state.state === "before") {
    const firstSubject = subjectAt(0);
    title = "مدرسه هنوز شروع نشده";
    detail = `شروع ${formatClock(state.firstBell.start)} · ${
      firstSubject?.name ?? state.firstBell.label
    }`;
    countdownLabel = "مانده تا شروع";
    remainingMs = state.remainingMs;
  } else if (state.state === "holiday") {
    title = "امروز تعطیل است";
    detail = "برنامهٔ هفتگی زنگ‌ها را ببین";
  } else {
    title = "کلاس‌ها تمام شد";
    detail = `آخرین زنگ ${formatClock(state.lastBell.end)}`;
  }

  return (
    <Panel
      onPress={onPress}
      accessibilityLabel="وضعیت کلاس و زنگ جاری"
      corners
      cornerTone={isBreak ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.20)"}
      style={[
        styles.card,
        isBreak
          ? {
              borderColor: "rgba(52,211,153,0.30)",
              backgroundColor: "rgba(8,20,17,0.92)",
            }
          : null,
      ]}
      contentStyle={styles.content}
    >
      {/* Glass glow — the web card's blurred halo, flattened into a gradient. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isBreak
            ? ["rgba(52,211,153,0.16)", "rgba(52,211,153,0)"]
            : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]
        }
        start={{ x: 0.85, y: 0 }}
        end={{ x: 0.15, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.row}>
        <View style={styles.right}>
          <View
            style={[
              styles.iconTile,
              isBreak
                ? {
                    borderColor: "rgba(52,211,153,0.32)",
                    backgroundColor: "rgba(52,211,153,0.12)",
                  }
                : null,
            ]}
          >
            <Ionicons name={iconFor(state)} size={21} color={tone} />
          </View>

          <View style={styles.text}>
            <MonoLabel tone={faintTone}>// CLASS STATUS</MonoLabel>
            <AppText
              numberOfLines={2}
              color={isBreak ? "#d1fae5" : colors.white}
              style={styles.title}
            >
              {title}
            </AppText>
            <AppText
              numberOfLines={1}
              color={softTone}
              style={styles.detail}
            >
              {detail}
            </AppText>
          </View>
        </View>

        {remainingMs !== null ? (
          <View style={styles.countdown}>
            <AppText
              ltr
              color={tone}
              style={styles.countdownValue}
            >
              {clock(remainingMs)}
            </AppText>
            <AppText
              numberOfLines={1}
              color={faintTone}
              style={styles.countdownLabel}
            >
              {countdownLabel}
            </AppText>
          </View>
        ) : null}
      </View>

      {progress !== null ? (
        <View style={styles.progressWrap}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, Math.round(progress * 100))}%`,
                  backgroundColor: tone,
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
              color={colors.faint}
              style={[styles.trackText, { fontVariant: ["tabular-nums"] }]}
            >
              {`${fmtNum(Math.max(0, Math.round(progress * 100)))}%`}
            </AppText>
          </View>
        </View>
      ) : null}

      {onPress ? (
        <View style={styles.footer}>
          <AppText color={colors.faint} style={styles.footerText}>
            برنامهٔ هفتگی زنگ‌ها
          </AppText>
          <Ionicons name="chevron-back" size={13} color={colors.faint} />
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderColor: colors.lineChip,
    backgroundColor: colors.panelPhone,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
  },
  right: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: colors.white05,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.black,
    fontSize: 19,
    lineHeight: 27,
  },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 1,
    textAlign: "right",
  },
  countdown: {
    alignItems: "flex-end",
    minWidth: 70,
  },
  countdownValue: {
    fontFamily: fonts.black,
    fontSize: 25,
    lineHeight: 31,
    fontVariant: ["tabular-nums"],
  },
  countdownLabel: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: "left",
  },
  progressWrap: { gap: 6, marginTop: 2 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
  trackMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  trackText: { fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 16 },
  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  footerText: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 16 },
});
