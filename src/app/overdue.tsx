import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchOverdueAssignments, qk } from "@/api/client";
import type { Assignment } from "@/api/types";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { Corners, Kicker, MonoLabel, Panel } from "@/components/webui";
import { useNow } from "@/hooks/useNow";
import { formatDue, fmtNum, parseDue, relativeDue } from "@/lib/format";
import { subjectName } from "@/lib/subjects";
import { colors, fonts, radius, screenGutter, spacing, tabBarReserve } from "@/theme/tokens";

/**
 * صفحهٔ «تکالیف مهلت گذشته».
 *
 * همان منبعی را می‌خواند که شمارندهٔ کارتِ صفحهٔ تکالیف (`qk.overdue`) —
 * همهٔ تکالیفی که مهلتشان گذشته، چه انجام‌شده و چه انجام‌نشده.
 */

const daysSince = (value: string | null | undefined, now: number): number => {
  const due = parseDue(value);
  if (!due) return 0;
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = new Date(now);
  const bb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((bb - a) / 86_400_000));
};

function OverdueRow({
  item,
  now,
  index,
  onOpen,
}: {
  item: Assignment;
  now: number;
  index: number;
  onOpen: () => void;
}) {
  const done = item.is_completed_by_me;
  const days = daysSince(item.due_date, now);
  const subject = subjectName(item.subject_id, item.course);

  return (
    <Animated.View entering={FadeInDown.duration(180).delay(Math.min(index * 20, 140))}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}، ${done ? "انجام‌شده" : "انجام‌نشده"}`}
      >
        <Corners />
        <View
          style={[
            styles.rowIcon,
            done
              ? { borderColor: "rgba(52,211,153,0.35)", backgroundColor: "rgba(52,211,153,0.12)" }
              : { borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.12)" },
          ]}
        >
          <Ionicons
            name={done ? "checkmark" : "alarm-outline"}
            size={17}
            color={done ? colors.success : colors.danger}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={styles.rowTitle}>
            <AppText
              numberOfLines={1}
              color={done ? colors.textSoft : colors.text}
              style={{ fontFamily: fonts.black, fontSize: 13, lineHeight: 19, flexShrink: 1 }}
            >
              {item.title}
            </AppText>
            <View
              style={[
                styles.statusBadge,
                done
                  ? { borderColor: "rgba(52,211,153,0.35)", backgroundColor: "rgba(52,211,153,0.10)" }
                  : { borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.10)" },
              ]}
            >
              <AppText
                color={done ? colors.success : colors.danger}
                style={{ fontSize: 9, lineHeight: 13 }}
              >
                {done ? "انجام‌شده" : "انجام‌نشده"}
              </AppText>
            </View>
          </View>

          <View style={styles.rowMeta}>
            {subject ? (
              <AppText
                numberOfLines={1}
                color={colors.faint}
                style={{ fontSize: 10.5, lineHeight: 16, flexShrink: 1 }}
              >
                {subject}
              </AppText>
            ) : null}
            {subject && item.due_date ? (
              <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 16 }}>
                ·
              </AppText>
            ) : null}
            {item.due_date ? (
              <AppText
                ltr
                color={colors.faint}
                style={{ fontSize: 10.5, lineHeight: 16, fontVariant: ["tabular-nums"] }}
              >
                {formatDue(item.due_date)}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <AppText
            ltr
            color={done ? colors.faint : colors.danger}
            style={{ fontSize: 10, lineHeight: 15, fontVariant: ["tabular-nums"] }}
          >
            {relativeDue(item.due_date, now)}
          </AppText>
          {days > 0 ? (
            <AppText
              ltr
              color={colors.faint}
              style={{ fontSize: 9, lineHeight: 13, fontVariant: ["tabular-nums"] }}
            >
              {`${fmtNum(days)} روز`}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function OverdueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(30_000);

  const query = useQuery({
    queryKey: qk.overdue,
    queryFn: fetchOverdueAssignments,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
  const doneCount = useMemo(
    () => items.filter((item) => item.is_completed_by_me).length,
    [items]
  );

  const open = (id: number) =>
    router.push({ pathname: "/assignment/[id]", params: { id: String(id) } });

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.danger}
            colors={[colors.danger]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        {/* header */}
        <Animated.View entering={FadeInDown.duration(180)} style={{ marginBottom: 16 }}>
          <Kicker text="overdue" dot style={{ marginBottom: 10 }} />

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
              تکالیف مهلت گذشته
            </AppText>
          </View>
          <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
            همهٔ تکالیفی که مهلتشان گذشته است — انجام‌شده و انجام‌نشده
          </AppText>
        </Animated.View>

        {!query.isLoading && items.length > 0 ? (
          <View style={styles.statsRow}>
            {[
              { label: "کل", value: items.length, tone: colors.text },
              { label: "انجام‌نشده", value: items.length - doneCount, tone: colors.danger },
              { label: "انجام‌شده", value: doneCount, tone: colors.success },
            ].map((stat) => (
              <Panel key={stat.label} corners contentStyle={styles.statBox}>
                <AppText
                  ltr
                  color={stat.tone}
                  style={{ fontFamily: fonts.black, fontSize: 18, lineHeight: 26, fontVariant: ["tabular-nums"] }}
                >
                  {fmtNum(stat.value)}
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 15 }}>
                  {stat.label}
                </AppText>
              </Panel>
            ))}
          </View>
        ) : null}

        {query.isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.skeleton} />
            ))}
          </View>
        ) : query.isError && items.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <View style={styles.emptyIconDanger}>
              <Ionicons name="refresh" size={20} color={colors.danger} />
            </View>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              بارگذاری داده‌ها ناموفق بود
            </AppText>
            <AppText align="center" color={colors.faint} style={{ fontSize: 12 }}>
              اتصال اینترنت را بررسی کنید.
            </AppText>
            <Pressable
              onPress={() => void query.refetch()}
              style={[styles.primaryButton, { marginTop: 4 }]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={14} color={colors.black} />
              <AppText color={colors.black} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                تلاش دوباره
              </AppText>
            </Pressable>
          </Panel>
        ) : items.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <View style={styles.emptyIconSuccess}>
              <Ionicons name="alarm-outline" size={22} color={colors.success} />
            </View>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              هیچ تکلیفی از مهلت نگذشته
            </AppText>
            <AppText align="center" color={colors.faint} style={{ fontSize: 12, lineHeight: 20 }}>
              وقتی مهلت تکلیفی تمام شود، همین‌جا با وضعیت انجام‌شده یا انجام‌نشده
              نمایش داده می‌شود.
            </AppText>
            <Pressable
              onPress={() => router.back()}
              style={[styles.ghostButton, { marginTop: 4 }]}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={14} color={colors.textSoft} />
              <AppText color={colors.textSoft} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                بازگشت به تکالیف
              </AppText>
            </Pressable>
          </Panel>
        ) : (
          <View style={{ gap: 12 }}>
            <MonoLabel style={{ marginBottom: 2 }}>// OVERDUE</MonoLabel>
            {items.map((item, index) => (
              <OverdueRow
                key={item.id}
                item={item}
                now={now}
                index={index}
                onOpen={() => open(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
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

  statsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  statBox: { paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 2 },

  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    padding: 14,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  rowTitle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  rowMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },

  skeleton: {
    height: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyIconDanger: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  emptyIconSuccess: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.30)",
    backgroundColor: "rgba(52,211,153,0.10)",
  },
  primaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: colors.white,
  },
  ghostButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
});
