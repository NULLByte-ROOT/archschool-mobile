import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/ui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, leftMinutes } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { dayForDate, flattenDay } from "@/lib/timetable";
import { colors, fonts } from "@/theme/tokens";

/**
 * One-line school status, mirroring the web `SchoolStatusStrip`:
 *
 *   [icon] زنگ تفریح           ۳۰ دقیقه مانده تا فارسی · 11:00
 *
 * Default tone: border rgba(255,255,255,0.12) / bg rgba(255,255,255,0.03) /
 * text #d4d4d8. Break tone: emerald border + bg + #a7f3d0.
 */
export function SchoolStatusStrip({
  compact = false,
}: {
  /** Slightly tighter padding for the dashboard header area. */
  compact?: boolean;
}) {
  const now = useNow(15_000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  const day = dayForDate(new Date(now));
  const rows = day ? flattenDay(day) : [];
  const subject = (index: number) => rows[index]?.subject?.name;

  let title = "";
  let detail = "";
  let icon: React.ComponentProps<typeof Ionicons>["name"] = "calendar-outline";
  const isBreak = state.state === "break";

  if (state.state === "class") {
    icon = "alarm-outline";
    title = subject(state.bellIndex) ?? state.bell.label;
    detail = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه مانده · تا ${formatClock(
      state.bell.end
    )}`;
  } else if (state.state === "break") {
    icon = "cafe-outline";
    title = "زنگ تفریح";
    detail = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه مانده تا ${
      subject(state.nextBellIndex) ?? state.nextBell.label
    } · ${formatClock(state.nextBell.start)}`;
  } else if (state.state === "before") {
    icon = "calendar-outline";
    title = "مدرسه هنوز شروع نشده";
    detail = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه مانده تا ${
      state.firstBell.label
    } · ${formatClock(state.firstBell.start)}`;
  } else if (state.state === "holiday") {
    icon = "moon-outline";
    title = "امروز تعطیل است";
    detail = "برنامهٔ روز بعد را ببین";
  } else {
    icon = "calendar-outline";
    title = "کلاس‌ها تمام شد";
    detail = `آخرین زنگ ${formatClock(state.lastBell.end)}`;
  }

  const textColor = isBreak ? "#a7f3d0" : colors.textSoft;

  return (
    <View
      style={[
        styles.root,
        compact && { paddingVertical: 8 },
        {
          borderColor: isBreak ? "rgba(52,211,153,0.30)" : colors.white12,
          backgroundColor: isBreak ? "rgba(52,211,153,0.07)" : colors.white03,
        },
      ]}
    >
      <View style={styles.right}>
        <View
          style={[
            styles.iconTile,
            {
              borderColor: isBreak ? "rgba(52,211,153,0.30)" : colors.white12,
              backgroundColor: isBreak ? "rgba(52,211,153,0.10)" : colors.white05,
            },
          ]}
        >
          <Ionicons name={icon} size={15} color={textColor} />
        </View>
        <AppText
          numberOfLines={1}
          color={textColor}
          style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, flexShrink: 1 }}
        >
          {title}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        color={textColor}
        style={{
          fontFamily: fonts.regular,
          fontSize: 11,
          lineHeight: 16,
          opacity: 0.75,
          flexShrink: 1,
        }}
      >
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  right: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
