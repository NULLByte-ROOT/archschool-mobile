import { StyleSheet, View } from "react-native";

import type { DailyActivity } from "@/api/types";
import { AppText } from "@/components/ui";
import { colors } from "@/theme/tokens";

const WEEK_LETTERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function weekdayLetter(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return WEEK_LETTERS[(date.getUTCDay() + 1) % 7] ?? "";
}

/**
 * Seven tiny columns for the last week's completion counts.
 *
 * Deliberately not a chart library: the dashboard and the profile sheet need
 * one glance, not axes, and a 7-bar motif echoes the class-week rhythm.
 */
export function WeekBars({
  data,
  maxBarHeight = 30,
}: {
  data: DailyActivity[];
  maxBarHeight?: number;
}) {
  const days = data.slice(-7);
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <View style={styles.week}>
      {days.map((day, index) => {
        const height = 5 + Math.round((day.count / max) * maxBarHeight);
        const isToday = index === days.length - 1;
        return (
          <View key={`${day.date}-${index}`} style={styles.weekColumn}>
            <View style={[styles.weekTrack, { height: maxBarHeight + 6 }]}>
              <View
                style={[
                  styles.weekBar,
                  {
                    height,
                    backgroundColor:
                      day.count > 0 ? colors.amber : "rgba(255,255,255,0.09)",
                    opacity: isToday && day.count === 0 ? 0.55 : 1,
                  },
                ]}
              />
            </View>
            <AppText
              variant="caption"
              color={isToday ? colors.amber : colors.faint}
              align="center"
              style={{ fontSize: 9.5, lineHeight: 13 }}
            >
              {weekdayLetter(day.date)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 4,
    paddingBottom: 4,
  },
  weekColumn: { alignItems: "center", gap: 3, width: 18 },
  weekTrack: {
    width: 8,
    borderRadius: 4,
    justifyContent: "flex-end",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  weekBar: { width: "100%", borderRadius: 4 },
});
