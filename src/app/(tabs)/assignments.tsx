import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ApiError, fetchAssignments, qk, toggleAssignment } from "@/api/client";
import type { Assignment } from "@/api/types";
import { EmptyState, SectionTitle, SkeletonRows } from "@/components/cards";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { AppText } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import {
  dueColor,
  dueTone,
  formatDue,
  isOverdue,
  parseDue,
  relativeDue,
} from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { categoryItemLabel } from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, shadows, spacing } from "@/theme/tokens";

type Filter = "all" | "pending" | "done";

type Row =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "item"; assignment: Assignment };

function AssignmentRow({
  assignment,
  now,
  onPress,
  onToggle,
}: {
  assignment: Assignment;
  now: number;
  onPress: () => void;
  onToggle: () => void;
}) {
  const done = assignment.is_completed_by_me;
  const tone = dueTone(assignment.due_date, now);
  const late = !done && isOverdue(assignment.due_date, now);
  const swipeRef = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        // `renderRightActions` opens when the row is dragged left; the
        // direction is the translation sign, so left is the completing swipe.
        if (direction === "left") {
          swipeRef.current?.close();
          onToggle();
        }
      }}
      renderRightActions={() => (
        <View
          style={[
            styles.swipeAction,
            {
              backgroundColor: done ? colors.blueSoft : colors.tealSoft,
              borderColor: done
                ? "rgba(106,155,255,0.35)"
                : "rgba(79,209,181,0.35)",
            },
          ]}
        >
          <Ionicons
            name={done ? "arrow-undo-outline" : "checkmark"}
            size={20}
            color={done ? colors.blue : colors.teal}
          />
          <AppText
            variant="caption"
            color={done ? colors.blue : colors.teal}
            style={{ fontFamily: fonts.medium }}
          >
            {done ? "بازگردانی" : "انجام شد"}
          </AppText>
        </View>
      )}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: late ? "rgba(242,104,107,0.30)" : colors.line,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.check,
            {
              backgroundColor: done ? colors.tealSoft : "transparent",
              borderColor: done
                ? "rgba(79,209,181,0.45)"
                : late
                  ? "rgba(242,104,107,0.5)"
                  : colors.lineStrong,
            },
          ]}
        >
          {done ? (
            <Ionicons name="checkmark" size={15} color={colors.teal} />
          ) : late ? (
            <View style={styles.lateDot} />
          ) : null}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <AppText
            variant="strong"
            numberOfLines={2}
            color={done ? colors.muted : colors.text}
            style={done ? { textDecorationLine: "line-through" } : undefined}
          >
            {assignment.title}
          </AppText>
          {assignment.description ? (
            <AppText
              variant="caption"
              color={colors.textSoft}
              numberOfLines={2}
              style={{ lineHeight: 19 }}
            >
              {assignment.description}
            </AppText>
          ) : null}
          <View style={styles.meta}>
            <AppText variant="caption" color={colors.faint} numberOfLines={1} style={{ flexShrink: 1 }}>
              {assignment.course || "بدون درس"}
              {" · "}
              {assignment.subtype
                ? categoryItemLabel(assignment.subtype)
                : "بدون دسته"}
            </AppText>
            <View style={styles.dot} />
            <AppText
              variant="caption"
              color={done ? colors.faint : late ? colors.red : dueColor(tone)}
              numberOfLines={1}
              style={{ fontFamily: fonts.medium }}
            >
              {done ? "تحویل شده" : relativeDue(assignment.due_date, now)}
            </AppText>
          </View>
          {assignment.due_date && !done ? (
            <AppText variant="caption" color={colors.faint} numberOfLines={1}>
              {formatDue(assignment.due_date)}
            </AppText>
          ) : null}
        </View>

        <Ionicons name="chevron-back" size={15} color={colors.faint} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function AssignmentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");

  const query = useQuery({
    queryKey: qk.assignments,
    queryFn: () => fetchAssignments(),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => toggleAssignment(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: qk.assignments });
      const previous = queryClient.getQueryData<Assignment[]>(qk.assignments);
      queryClient.setQueryData<Assignment[]>(qk.assignments, (old) =>
        (old ?? []).map((item) => {
          if (item.id !== id) return item;
          const nextDone = !item.is_completed_by_me;
          return {
            ...item,
            is_completed_by_me: nextDone,
            completed: nextDone,
            completed_by_users: nextDone
              ? [
                  ...item.completed_by_users.filter((person) => person.id !== user?.id),
                  { id: user?.id ?? 0, username: user?.username ?? null },
                ]
              : item.completed_by_users.filter((person) => person.id !== user?.id),
          };
        })
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.assignments, context.previous);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined
      );
      const message =
        error instanceof ApiError
          ? error.message
          : "تغییر وضعیت انجام نشد. دوباره تلاش کنید.";
      Alert.alert(
        error instanceof ApiError && error.status === 429 ? "محدودیت ضدتقلب" : "خطا",
        message
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Assignment[]>(qk.assignments, (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item))
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      void queryClient.invalidateQueries({ queryKey: qk.overview });
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
      void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
      void queryClient.invalidateQueries({ queryKey: qk.assignment(updated.id) });
      void queryClient.invalidateQueries({ queryKey: qk.assignmentTeam(updated.id) });
    },
  });

  const all = query.data ?? [];
  const pending = all.filter((item) => !item.is_completed_by_me);
  const done = all.filter((item) => item.is_completed_by_me);

  const rows = useMemo<Row[]>(() => {
    const sortPending = (items: Assignment[]) =>
      [...items].sort((a, b) => {
        const da = parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    const urgent = sortPending(
      pending.filter((item) => dueTone(item.due_date, now) === "red")
    );
    const upcoming = sortPending(
      pending.filter((item) => dueTone(item.due_date, now) !== "red")
    );
    const completed = [...done].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const result: Row[] = [];
    const pushGroup = (key: string, title: string, items: Assignment[]) => {
      if (items.length === 0) return;
      result.push({ kind: "header", key: `${key}-h`, title, count: items.length });
      for (const assignment of items) {
        result.push({ kind: "item", assignment });
      }
    };

    if (filter !== "done") {
      pushGroup("urgent", "فوری", urgent);
      pushGroup("upcoming", "پیشِ رو", upcoming);
    }
    if (filter !== "pending") {
      pushGroup("done", "تحویل‌شده", completed);
    }
    return result;
  }, [done, filter, now, pending]);

  const staff = isStaff(user);

  return (
    <Screen edges={["top"]}>
      <Header
        title="تکالیف"
        subtitle={`${pending.length} تکلیف باز · ${done.length} تحویل‌شده`}
        actions={
          staff ? (
            <Pressable
              onPress={() => router.push("/new-assignment")}
              style={styles.headerAction}
              hitSlop={8}
              accessibilityLabel="تکلیف جدید"
            >
              <Ionicons name="add" size={20} color={colors.amber} />
            </Pressable>
          ) : null
        }
      />

      <View style={{ paddingHorizontal: screenGutter, paddingBottom: spacing.sm }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "همه", count: all.length },
            { key: "pending", label: "مانده", count: pending.length },
            { key: "done", label: "انجام‌شده", count: done.length },
          ]}
        />
      </View>

      {query.isLoading ? (
        <View style={{ paddingHorizontal: screenGutter }}>
          <SkeletonRows count={4} height={86} />
        </View>
      ) : query.isError && !query.data ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="تکالیف بارگذاری نشد"
          hint="اتصال اینترنت را بررسی کنید."
          actionLabel="تلاش دوباره"
          onAction={() => void query.refetch()}
        />
      ) : (
        <FlashList<Row>
          data={rows}
          keyExtractor={(item) =>
            item.kind === "header" ? item.key : `assignment-${item.assignment.id}`
          }
          renderItem={({ item, index }) =>
            item.kind === "header" ? (
              <Animated.View
                entering={FadeInDown.duration(240)}
                style={[
                  styles.groupHeader,
                  { marginTop: index === 0 ? 2 : spacing.lg },
                ]}
              >
                <SectionTitle
                  title={item.title}
                  hint={`${item.count} مورد`}
                />
              </Animated.View>
            ) : (
              <AssignmentRow
                assignment={item.assignment}
                now={now}
                onPress={() =>
                  router.push({
                    pathname: "/assignment/[id]",
                    params: { id: String(item.assignment.id) },
                  })
                }
                onToggle={() => toggle.mutate(item.assignment.id)}
              />
            )
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={colors.amber}
              colors={[colors.amber]}
              progressBackgroundColor={colors.panel}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                filter === "done"
                  ? "hourglass-outline"
                  : "checkmark-done-circle-outline"
              }
              title={
                filter === "done"
                  ? "هنوز چیزی تحویل ندادی"
                  : "تکلیف بازی نمانده"
              }
              hint={
                filter === "done"
                  ? "با کشیدن هر تکلیف به سمت چپ، انجام‌شده علامت بزن."
                  : "همه‌چیز انجام شده است. نفس راحت بکش."
              }
            />
          }
        />
      )}

      {staff ? (
        <Pressable
          onPress={() => router.push("/new-assignment")}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel="ساخت تکلیف جدید"
        >
          <Ionicons name="add" size={25} color="#171004" />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: 130,
  },
  groupHeader: { paddingTop: spacing.xs },
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.panel,
    boxShadow: shadows.card,
    overflow: "hidden",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  lateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  meta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.faint,
  },
  swipeAction: {
    width: 96,
    marginVertical: 2,
    marginLeft: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  fab: {
    position: "absolute",
    bottom: 110,
    right: screenGutter,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amber,
    boxShadow: shadows.amber,
  },
});
