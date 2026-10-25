import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { GlassCard } from "@/components/cards";
import { AppText } from "@/components/ui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import {
  formatClock,
  getCurrentBellState,
  leftMinutes,
  type CurrentBellState,
} from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

function iconFor(state: CurrentBellState): ComponentProps<typeof Ionicons>["name"] {
  if (state.state === "class") return "alarm-outline";
  if (state.state === "break") return "cafe-outline";
  if (state.state === "before") return "sunny-outline";
  if (state.state === "holiday") return "moon-outline";
  return "calendar-outline";
}

export function SchoolStatusCard({ onPress }: { onPress?: () => void }) {
  const now = useNow(15_000);
  const { bells } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  const isBreak = state.state === "break";
  const tone = isBreak ? colors.teal : state.state === "class" ? colors.amber : colors.muted;

  let title = "زنگ جاری";
  let detail = "";
  let countdown = "";
  let progress: number | null = null;

  if (state.state === "class") {
    title = state.bell.label;
    detail = `کلاس در جریان است · تا ${formatClock(state.bell.end)}`;
    countdown = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه`;
    progress = state.progress;
  } else if (state.state === "break") {
    title = "زنگ تفریح";
    detail = `زنگ بعد: ${state.nextBell.label} · ${formatClock(state.nextBell.start)}`;
    countdown = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه`;
    progress = state.progress;
  } else if (state.state === "before") {
    title = "مدرسه هنوز شروع نشده";
    detail = `اولین زنگ ${formatClock(state.firstBell.start)}`;
    countdown = `${fmtNum(leftMinutes(state.remainingMs))} دقیقه`;
  } else if (state.state === "holiday") {
    title = "امروز تعطیل است";
    detail = "برنامهٔ زنگ‌های هفته را ببین";
  } else {
    title = "کلاس‌ها تمام شد";
    detail = `آخرین زنگ تا ${formatClock(state.lastBell.end)}`;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel="وضعیت زنگ مدرسه"
    >
      <GlassCard
        style={[
          styles.card,
          isBreak && {
            borderColor: "rgba(79,209,181,0.35)",
            backgroundColor: "rgba(79,209,181,0.06)",
          },
        ]}
        contentStyle={styles.content}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: isBreak ? colors.tealSoft : colors.amberSoft,
                borderColor: isBreak ? "rgba(79,209,181,0.35)" : colors.amberLine,
              },
            ]}
          >
            <Ionicons name={iconFor(state)} size={18} color={tone} />
          </View>

          <View style={styles.text}>
            <AppText variant="strong" color={isBreak ? colors.teal : colors.text} numberOfLines={1}>
              {title}
            </AppText>
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {detail}
            </AppText>
          </View>

          {countdown ? (
            <View style={styles.countdown}>
              <AppText
                variant="numberSm"
                color={tone}
                ltr
                style={{ fontFamily: fonts.bold, fontSize: 17 }}
              >
                {countdown}
              </AppText>
              <AppText variant="caption" color={colors.faint} style={{ fontSize: 9 }}>
                مانده
              </AppText>
            </View>
          ) : null}
        </View>

        {progress !== null ? (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, Math.round(progress * 100))}%`,
                  backgroundColor: isBreak ? colors.teal : colors.amber,
                },
              ]}
            />
          </View>
        ) : null}

        {onPress ? (
          <View style={styles.footer}>
            <AppText variant="caption" color={colors.faint}>
              برنامهٔ هفتگی زنگ‌ها
            </AppText>
            <Ionicons name="chevron-back" size={13} color={colors.faint} />
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  content: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  countdown: { alignItems: "center", gap: 0 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  footer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
