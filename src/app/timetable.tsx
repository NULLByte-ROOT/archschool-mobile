import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { GlassCard } from "@/components/cards";
import { Header } from "@/components/Header";
import { SchoolStatusCard } from "@/components/SchoolStatusCard";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { formatClock, getCurrentBellState, leftMinutes } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

export default function TimetableScreen() {
  const router = useRouter();
  const now = useNow(15_000);
  const { bells, ready } = useBellSchedule();
  const state = getCurrentBellState(now, bells);

  return (
    <Screen edges={["top", "bottom"]}>
      <Header
        title="برنامهٔ زنگ‌ها"
        subtitle={
          ready
            ? `${formatClock(bells[0]?.start ?? 8 * 60)} تا ${formatClock(
                bells[bells.length - 1]?.end ?? 14 * 60
              )} · ${fmtNum(bells.length)} زنگ`
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
              <Ionicons name="time-outline" size={17} color={colors.amber} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
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

        <AppText variant="caption" color={colors.faint} align="center" style={{ marginTop: spacing.sm }}>
          با هر بار باز کردن این صفحه، زمان‌ها دوباره از سرور خوانده می‌شوند.
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
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  list: { gap: 8 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
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
    borderRadius: radius.sm,
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
