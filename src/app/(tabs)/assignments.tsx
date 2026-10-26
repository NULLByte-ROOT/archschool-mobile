import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  deleteAssignment,
  fetchAssignments,
  qk,
  toggleAssignment,
} from "@/api/client";
import type { Assignment } from "@/api/types";
import { AreaChart, Donut, SegmentedBar } from "@/components/charts";
import { SchoolStatusStrip } from "@/components/SchoolStatusStrip";
import { Screen } from "@/components/Screen";
import { SelectSheet, type SelectOption } from "@/components/SelectSheet";
import { AppText, Avatar } from "@/components/ui";
import {
  Corners,
  IconTile,
  Kicker,
  MonoLabel,
  Panel,
  PulseDot,
} from "@/components/webui";
import { useNow } from "@/hooks/useNow";
import { DAY_MS, formatDue, fmtNum, parseDue, relativeDue } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { SUBJECT_LIST, categoryGroup, categoryItemLabel, subjectName } from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

type Status = "all" | "active" | "done";
type Sort = "newest" | "oldest" | "deadline";
type ViewMode = "list" | "grid";
type Tone = "red" | "yellow" | "none";

const HOUR_MS = 3_600_000;

const STATUS_FILTERS: { key: Status; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "active", label: "انجام‌نشده" },
  { key: "done", label: "انجام‌شده" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "", label: "همه دسته‌ها" },
  { value: "homework", label: "تکلیف‌ها" },
  { value: "exam", label: "امتحان" },
  { value: "project", label: "پروژه عملی" },
];

const SUBJECT_OPTIONS: SelectOption[] = [
  { value: "", label: "همه درس‌ها" },
  ...SUBJECT_LIST.map((subject) => ({
    value: subject.id,
    label: subject.name,
    description: subject.teacher,
  })),
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "جدیدترین ابتدا" },
  { value: "oldest", label: "قدیمی‌ترین ابتدا" },
  { value: "deadline", label: "نزدیک‌ترین ددلاین" },
];

const TONE_DOT: Record<Tone, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  none: "rgba(255,255,255,0.40)",
};

const CHIP: Record<Tone, { border: string; bg: string; text: string }> = {
  red: { border: "rgba(239,68,68,0.30)", bg: "rgba(239,68,68,0.10)", text: "#fca5a5" },
  yellow: { border: "rgba(234,179,8,0.25)", bg: "rgba(234,179,8,0.10)", text: "#fde047" },
  none: { border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.04)", text: colors.textSoft },
};

const SURFACE_BORDER: Record<Tone, string> = {
  red: "rgba(239,68,68,0.35)",
  yellow: "rgba(234,179,8,0.25)",
  none: "rgba(255,255,255,0.10)",
};

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function toneFor(due: string | null, now: number): Tone {
  const date = parseDue(due);
  if (!date) return "none";
  const diff = date.getTime() - now;
  if (diff < DAY_MS) return "red";
  if (diff < DAY_MS * 2) return "yellow";
  return "none";
}

function shortLeft(due: string | null, now: number): string {
  const date = parseDue(due);
  if (!date) return "بدون مهلت";
  const diff = date.getTime() - now;
  if (diff <= 0) {
    const days = Math.max(1, Math.round(-diff / DAY_MS));
    return -diff < DAY_MS ? "مهلت گذشته" : `${fmtNum(days)} روز گذشته`;
  }
  if (diff < HOUR_MS) return `${fmtNum(Math.max(1, Math.round(diff / 60_000)))} دقیقه مانده`;
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    const minutes = Math.round((diff % HOUR_MS) / 60_000);
    return minutes
      ? `${fmtNum(hours)} ساعت و ${fmtNum(minutes)} دقیقه مانده`
      : `${fmtNum(hours)} ساعت مانده`;
  }
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.round((diff % DAY_MS) / HOUR_MS);
  return hours
    ? `${fmtNum(days)} روز و ${fmtNum(hours)} ساعت مانده`
    : `${fmtNum(days)} روز مانده`;
}

function CreatedBadge({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <View style={styles.creatorBadge}>
      <PulseDot size={4} tone={colors.white} glow={false} />
      <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 9, lineHeight: 13 }}>
        ساخته شده توسط: {name}
      </AppText>
    </View>
  );
}

function CompletedStack({ users }: { users: Assignment["completed_by_users"] }) {
  if (users.length === 0) return null;
  return (
    <View style={styles.stack} accessibilityLabel="انجام‌دهندگان">
      {users.slice(0, 5).map((person, index) => (
        <Avatar
          key={`${person.id}-${index}`}
          name={person.username ?? "?"}
          size="xs"
          style={[styles.stackAvatar, index > 0 && { marginRight: -6 }]}
        />
      ))}
      {users.length > 5 ? (
        <AppText ltr color={colors.faint} style={{ fontSize: 9.5, lineHeight: 14, marginRight: 4 }}>
          +{fmtNum(users.length - 5)}
        </AppText>
      ) : null}
    </View>
  );
}

function ToggleButton({
  assignment,
  busy,
  onPress,
}: {
  assignment: Assignment;
  busy: boolean;
  onPress: () => void;
}) {
  const done = assignment.is_completed_by_me;
  const label = done ? "برگرداندن" : assignment.category === "exam" ? "خوندم" : "انجام دادم";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.toggle,
        done ? styles.toggleDone : styles.toggleOpen,
        pressed && { opacity: 0.8 },
        busy && { opacity: 0.5 },
      ]}
    >
      <Ionicons name="checkmark" size={12} color={done ? colors.success : colors.textSoft} />
      <AppText
        color={done ? colors.success : colors.textSoft}
        style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Assignment card                                                    */
/* ------------------------------------------------------------------ */

function AssignmentCard({
  assignment,
  view,
  now,
  canManage,
  busy,
  onOpen,
  onToggle,
  onEdit,
  onDelete,
}: {
  assignment: Assignment;
  view: ViewMode;
  now: number;
  canManage: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = assignment.is_completed_by_me;
  const tone = done ? "none" : toneFor(assignment.due_date, now);
  const group = categoryGroup(assignment.category);
  const icon: ComponentProps<typeof Ionicons>["name"] =
    assignment.category === "exam" ? "school" : "clipboard";
  const chip = CHIP[tone];

  const countdown = (
    <View style={styles.countdownWrap}>
      <View style={[styles.chip, { borderColor: chip.border, backgroundColor: chip.bg }]}>
        <Ionicons name="alarm-outline" size={11} color={chip.text} />
        <AppText
          numberOfLines={1}
          color={chip.text}
          style={{ fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 15 }}
        >
          {done ? "تحویل شده" : shortLeft(assignment.due_date, now)}
        </AppText>
      </View>
    </View>
  );

  const editButton = canManage ? (
    <Pressable
      onPress={onEdit}
      style={styles.cardIconButton}
      accessibilityRole="button"
      accessibilityLabel="ویرایش تکلیف"
      hitSlop={4}
    >
      <Ionicons name="pencil" size={14} color={colors.faint} />
    </Pressable>
  ) : null;

  const deleteButton = canManage ? (
    <Pressable
      onPress={onDelete}
      style={styles.cardIconButton}
      accessibilityRole="button"
      accessibilityLabel="حذف تکلیف"
      hitSlop={4}
    >
      <Ionicons name="trash-outline" size={14} color={colors.faint} />
    </Pressable>
  ) : null;

  if (view === "grid") {
    return (
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.gridCard,
          { borderColor: SURFACE_BORDER[tone] },
          pressed && { opacity: 0.94 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={assignment.title}
      >
        <Corners />
        <View style={[styles.gridEdge, { backgroundColor: TONE_DOT[tone] }]} />

        <View style={styles.gridHead}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, flexShrink: 1 }}>
            <IconTile name={icon} size={32} iconSize={15} tone={done ? colors.faint : colors.white} />
            <AppText
              numberOfLines={1}
              color={colors.textSoft}
              style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 }}
            >
              {group?.label ?? "بدون دسته"}
              {assignment.subtype ? (
                <AppText color={colors.faint}> · {categoryItemLabel(assignment.subtype)}</AppText>
              ) : null}
            </AppText>
          </View>
          {countdown}
        </View>

        <AppText
          numberOfLines={2}
          color={done ? colors.faint : colors.white}
          style={[
            {
              fontFamily: fonts.black,
              fontSize: 16,
              lineHeight: 24,
              marginTop: 4,
            },
            done ? { textDecorationLine: "line-through" } : null,
          ]}
        >
          {assignment.title}
        </AppText>

        {assignment.description ? (
          <AppText
            numberOfLines={2}
            color={colors.textSoft}
            style={{ fontSize: 12, lineHeight: 20, marginTop: 6 }}
          >
            {assignment.description}
          </AppText>
        ) : null}

        <View style={{ gap: 6, marginTop: 10 }}>
          <View style={styles.metaLine}>
            <Ionicons name="book-outline" size={12} color={colors.faint} />
            <AppText
              numberOfLines={1}
              color={colors.textSoft}
              style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, flexShrink: 1 }}
            >
              {subjectName(assignment.subject_id, assignment.course) || "بدون درس"}
            </AppText>
          </View>
          <View style={styles.metaLine}>
            <Ionicons name="calendar-outline" size={12} color={colors.faint} style={{ opacity: 0.7 }} />
            <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 11.5, lineHeight: 17, flexShrink: 1 }}>
              {formatDue(assignment.due_date)}
            </AppText>
          </View>
        </View>

        <View style={styles.gridFooter}>
          <CompletedStack users={assignment.completed_by_users} />
          <ToggleButton assignment={assignment} busy={busy} onPress={onToggle} />
          {editButton}
          {deleteButton}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.listCard,
        { borderColor: SURFACE_BORDER[tone] },
        pressed && { opacity: 0.94 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={assignment.title}
    >
      <Corners />
      <View style={[styles.listEdge, { backgroundColor: TONE_DOT[tone] }]} />

      <View style={styles.listTop}>
        <IconTile
          name={icon}
          size={44}
          iconSize={18}
          tone={done ? colors.faint : colors.white}
        />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <AppText
              numberOfLines={2}
              color={done ? colors.faint : colors.white}
              style={[
                { fontFamily: fonts.black, fontSize: 15, lineHeight: 23, flexShrink: 1 },
                done ? { textDecorationLine: "line-through" } : null,
              ]}
            >
              {assignment.title}
            </AppText>
            <CreatedBadge name={assignment.creator_username} />
          </View>

          {assignment.description ? (
            <AppText
              numberOfLines={2}
              color={colors.textSoft}
              style={{ fontSize: 12, lineHeight: 20, marginTop: 2 }}
            >
              {assignment.description}
            </AppText>
          ) : null}

          <View style={styles.metaWrap}>
            <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 11, lineHeight: 17 }}>
              {group?.label ?? "بدون دسته"}
              {assignment.subtype ? (
                <AppText color={colors.faint}> · {categoryItemLabel(assignment.subtype)}</AppText>
              ) : null}
            </AppText>
            <View style={styles.metaLine}>
              <Ionicons name="book-outline" size={12} color={colors.faint} />
              <AppText
                numberOfLines={1}
                color={colors.textSoft}
                style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, flexShrink: 1 }}
              >
                {subjectName(assignment.subject_id, assignment.course) || "بدون درس"}
              </AppText>
            </View>
            <View style={styles.metaLine}>
              <Ionicons name="calendar-outline" size={11} color={colors.faint} style={{ opacity: 0.7 }} />
              <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 11, lineHeight: 17, flexShrink: 1 }}>
                {formatDue(assignment.due_date)}
              </AppText>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.listFooter}>
        {countdown}
        <CompletedStack users={assignment.completed_by_users} />
        <ToggleButton assignment={assignment} busy={busy} onPress={onToggle} />
        {editButton}
        {deleteButton}
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-back" size={16} color={colors.faint} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard panels                                                   */
/* ------------------------------------------------------------------ */

function PanelTitle({
  label,
  title,
  icon,
  accessory,
}: {
  label: string;
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  accessory?: ReactNode;
}) {
  return (
    <View style={styles.panelHead}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
        <IconTile name={icon} size={32} iconSize={15} tone={colors.textSoft} />
        <View style={{ minWidth: 0 }}>
          <MonoLabel>{label}</MonoLabel>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}>{title}</AppText>
        </View>
      </View>
      {accessory}
    </View>
  );
}

function WorkloadPanel({ items, now }: { items: Assignment[]; now: number }) {
  const { data, total } = useMemo(() => {
    const base = new Date(now);
    const day0 = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
    const counts = new Map<number, number>();
    for (const item of items) {
      if (item.is_completed_by_me) continue;
      const due = parseDue(item.due_date);
      if (!due) continue;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
      const offset = Math.round((dueDay - day0) / DAY_MS);
      if (offset >= 0 && offset <= 6) counts.set(offset, (counts.get(offset) ?? 0) + 1);
    }
    const points = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(day0);
      date.setDate(date.getDate() + index);
      return {
        label: date.toLocaleDateString("fa-IR-u-nu-latn", { weekday: "short" }),
        value: counts.get(index) ?? 0,
      };
    });
    return { data: points, total: points.reduce((sum, point) => sum + point.value, 0) };
  }, [items, now]);

  return (
    <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
      <PanelTitle label="// WORKLOAD" title="روند مهلت‌های ۷ روز آینده" icon="calendar-outline" accessory={
        <View style={styles.badge}>
          <Ionicons name="calendar-outline" size={11} color={colors.textSoft} />
          <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
            {fmtNum(total)} مهلت پیشِ رو
          </AppText>
        </View>
      } />

      {total === 0 ? (
        <View style={styles.chartEmpty}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            مهلتی برای هفت روز آینده ثبت نشده
          </AppText>
        </View>
      ) : (
        <>
          <View style={{ direction: "ltr" }}>
            <AreaChart data={data} height={150} />
          </View>
          <View style={styles.axisRow}>
            {data.map((point, index) => (
              <AppText
                key={`${point.label}-${index}`}
                align="center"
                color="rgba(255,255,255,0.45)"
                style={{ fontSize: 9.5, lineHeight: 14, flex: 1 }}
              >
                {point.label}
              </AppText>
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

function SubjectsPanel({ items }: { items: Assignment[] }) {
  const slices = useMemo(() => {
    const palette = ["#fafafa", "#a5b4fc", "#6ee7b7", "#fbbf24", "#f87171", "#94a3b8"];
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.subject_id) continue;
      counts.set(item.subject_id, (counts.get(item.subject_id) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 5);
    const rest = ranked.slice(5).reduce((sum, [, value]) => sum + value, 0);
    const result = top.map(([id, value], index) => ({
      label: subjectName(id) || id,
      value,
      color: palette[index % palette.length],
    }));
    if (rest > 0) result.push({ label: "سایر درس‌ها", value: rest, color: palette[5] });
    return result;
  }, [items]);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
      <PanelTitle label="// SUBJECTS" title="توزیع بر اساس درس" icon="book-outline" accessory={
        <View style={styles.badge}>
          <Ionicons name="book-outline" size={11} color={colors.textSoft} />
          <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
            {fmtNum(slices.length)} درس
          </AppText>
        </View>
      } />

      {total === 0 ? (
        <View style={styles.chartEmpty}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            تکلیفی با درس مشخص ثبت نشده
          </AppText>
        </View>
      ) : (
        <View style={styles.subjectsRow}>
          <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
            <Donut
              slices={slices}
              size={132}
              thickness={20}
              centerValue={fmtNum(total)}
              centerLabel="کل تکلیف"
            />
            <View style={styles.donutCenter} pointerEvents="none">
              <AppText ltr style={{ fontFamily: fonts.black, fontSize: 20, lineHeight: 27 }}>
                {fmtNum(total)}
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 9, lineHeight: 13 }}>
                کل تکلیف
              </AppText>
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            {slices.map((slice) => (
              <View key={slice.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 11, flex: 1 }}>
                  {slice.label}
                </AppText>
                <AppText ltr color={colors.white} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                  {fmtNum(slice.value)}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

function ActivityPanel({
  completed,
  total,
  onPress,
}: {
  completed: number;
  total: number;
  onPress: () => void;
}) {
  const pending = Math.max(0, total - completed);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Panel corners onPress={onPress} contentStyle={styles.panelPad} style={{ marginBottom: 16 }} accessibilityLabel="وضعیت تکالیف">
      <PanelTitle label="// ACTIVITY" title="وضعیت تکالیف" icon="arrow-up-outline" />

      <View style={{ marginTop: 8 }}>
        <View style={styles.activityTop}>
          <AppText ltr style={{ fontFamily: fonts.black, fontSize: 30, lineHeight: 36, fontVariant: ["tabular-nums"] }}>
            {fmtNum(pct)}%
          </AppText>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            {fmtNum(completed)} از {fmtNum(total)} انجام شده
          </AppText>
        </View>
        <View style={styles.activityTrack}>
          <View
            style={[
              styles.activityFill,
              { width: `${total > 0 ? (completed / total) * 100 : 0}%` },
            ]}
          />
        </View>
        <View style={styles.activityLegend}>
          <View style={styles.legendRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <AppText color={colors.textSoft} style={{ fontSize: 11, flex: 1 }}>
              انجام‌شده
            </AppText>
            <AppText ltr style={{ fontFamily: fonts.bold, fontSize: 12 }}>
              {fmtNum(completed)}
            </AppText>
          </View>
          <View style={styles.legendRow}>
            <Ionicons name="ellipse-outline" size={14} color="rgba(255,255,255,0.45)" />
            <AppText color={colors.textSoft} style={{ fontSize: 11, flex: 1 }}>
              باقی‌مانده
            </AppText>
            <AppText ltr style={{ fontFamily: fonts.bold, fontSize: 12 }}>
              {fmtNum(pending)}
            </AppText>
          </View>
        </View>
      </View>
    </Panel>
  );
}

function TypesPanel({ items }: { items: Assignment[] }) {
  const { homework, exam, project, total } = useMemo(() => {
    const examCount = items.filter((item) => item.category === "exam").length;
    const projectCount = items.filter(
      (item) => item.category !== "exam" && item.subtype === "practical"
    ).length;
    const homeworkCount = items.filter(
      (item) => item.category !== "exam" && item.subtype !== "practical"
    ).length;
    return {
      homework: homeworkCount,
      exam: examCount,
      project: projectCount,
      total: homeworkCount + examCount + projectCount,
    };
  }, [items]);

  const rows = [
    { label: "تکلیف", value: homework, color: "#f4f4f5", icon: "clipboard-outline" as const },
    { label: "امتحان", value: exam, color: "#a1a1aa", icon: "school-outline" as const },
    { label: "پروژه", value: project, color: "#52525b", icon: "layers-outline" as const },
  ];

  return (
    <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
      <PanelTitle label="// TYPES" title="ترکیب تکالیف" icon="layers-outline" accessory={
        <View style={styles.badge}>
          <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
            {fmtNum(total)} ITEM
          </AppText>
        </View>
      } />

      {total === 0 ? (
        <View style={styles.chartEmpty}>
          <AppText color={colors.faint} style={{ fontSize: 11 }}>
            هنوز تکلیفی ثبت نشده
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <SegmentedBar
            height={12}
            slices={rows.map((row) => ({ label: row.label, value: row.value, color: row.color }))}
          />
          {rows.map((row) => (
            <View key={row.label} style={styles.legendRow}>
              <Ionicons name={row.icon} size={14} color={row.color} />
              <AppText color={colors.textSoft} style={{ fontSize: 11, flex: 1 }}>
                {row.label}
              </AppText>
              <AppText ltr style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                {fmtNum(row.value)}
              </AppText>
              <AppText
                ltr
                color={colors.faint}
                style={{ fontSize: 9, width: 30, textAlign: "left", fontVariant: ["tabular-nums"] }}
              >
                {fmtNum(Math.round((row.value / total) * 100))}%
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

function DeadlinesPanel({
  items,
  now,
  onOpen,
}: {
  items: Assignment[];
  now: number;
  onOpen: (id: number) => void;
}) {
  return (
    <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
      <PanelTitle label="// DEADLINES" title="مهلت‌های نزدیک" icon="time-outline" accessory={
        <IconTile name="calendar-outline" size={32} iconSize={15} tone={colors.white} />
      } />

      {items.length === 0 ? (
        <AppText align="center" color={colors.faint} style={{ fontSize: 11, paddingVertical: 24 }}>
          مهلت نزدیکی ثبت نشده
        </AppText>
      ) : (
        <View style={{ gap: 6 }}>
          {items.map((item) => {
            const tone = toneFor(item.due_date, now);
            return (
              <Pressable
                key={item.id}
                onPress={() => onOpen(item.id)}
                style={({ pressed }) => [
                  styles.deadlineRow,
                  { borderColor: tone === "none" ? colors.white12 : CHIP[tone].border },
                  pressed && { backgroundColor: colors.white05 },
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.deadlineDot, { backgroundColor: TONE_DOT[tone] }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    numberOfLines={1}
                    color={colors.white}
                    style={{ fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 17 }}
                  >
                    {item.title}
                  </AppText>
                  <AppText numberOfLines={1} color={colors.faint} style={{ fontSize: 10, lineHeight: 15 }}>
                    {subjectName(item.subject_id, item.course) || "بدون درس"}
                  </AppText>
                </View>
                <AppText
                  numberOfLines={1}
                  color={tone === "red" ? colors.danger : tone === "yellow" ? colors.dueYellowText : colors.textSoft}
                  style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 15, flexShrink: 0, maxWidth: 110 }}
                >
                  {shortLeft(item.due_date, now)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

export default function AssignmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const now = useNow(30_000);
  const staff = isStaff(user);

  const [filter, setFilter] = useState<Status>("all");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<ViewMode>("list");
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"category" | "subject" | "sort" | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };

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
      if (context?.previous) queryClient.setQueryData(qk.assignments, context.previous);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      showToast(
        error instanceof ApiError && error.message
          ? error.message
          : "تغییر وضعیت انجام نشد. دوباره تلاش کنید."
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Assignment[]>(qk.assignments, (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item))
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: qk.overview });
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
      void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
      void queryClient.invalidateQueries({ queryKey: qk.assignment(updated.id) });
      void queryClient.invalidateQueries({ queryKey: qk.assignmentTeam(updated.id) });
      void queryClient.invalidateQueries({ queryKey: qk.assignments });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteAssignment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.assignments });
      void queryClient.invalidateQueries({ queryKey: qk.overview });
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
    },
    onError: (error) => {
      showToast(error instanceof ApiError && error.message ? error.message : "حذف تکلیف انجام نشد.");
    },
  });

  const all = query.data ?? [];
  const completedCount = all.filter((item) => item.is_completed_by_me).length;

  const filtered = useMemo(() => {
    let list = all;
    if (filter === "active") list = list.filter((item) => !item.is_completed_by_me);
    if (filter === "done") list = list.filter((item) => item.is_completed_by_me);
    if (category === "project") list = list.filter((item) => item.subtype === "practical");
    else if (category) list = list.filter((item) => item.category === category);
    if (subject) list = list.filter((item) => item.subject_id === subject);
    return list;
  }, [all, category, filter, subject]);

  const displayed = useMemo(() => {
    const list = [...filtered];
    const deadline = (item: Assignment) =>
      parseDue(item.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (sort === "deadline") {
      list.sort(
        (a, b) =>
          deadline(a) - deadline(b) ||
          (parseDue(b.created_at)?.getTime() ?? 0) - (parseDue(a.created_at)?.getTime() ?? 0)
      );
    } else {
      const direction = sort === "oldest" ? 1 : -1;
      list.sort(
        (a, b) =>
          direction *
          ((parseDue(a.created_at)?.getTime() ?? 0) - (parseDue(b.created_at)?.getTime() ?? 0))
      );
    }
    return list;
  }, [filtered, sort]);

  const pending = all.filter((item) => !item.is_completed_by_me);

  const groups = useMemo(() => {
    const overdue: Assignment[] = [];
    const urgent: Assignment[] = [];
    const later: Assignment[] = [];
    const completed: Assignment[] = [];
    for (const item of displayed) {
      if (item.is_completed_by_me) {
        completed.push(item);
        continue;
      }
      const due = parseDue(item.due_date);
      if (!due) {
        later.push(item);
      } else if (due.getTime() <= now) {
        overdue.push(item);
      } else if (due.getTime() - now < DAY_MS * 2) {
        urgent.push(item);
      } else {
        later.push(item);
      }
    }
    return [
      { key: "overdue", title: "گذشته از مهلت", tone: "red" as Tone, items: overdue },
      { key: "urgent", title: "فوری (کمتر از ۴۸ ساعت)", tone: "red" as Tone, items: urgent },
      { key: "upcoming", title: "پیشِ رو", tone: "yellow" as Tone, items: later },
      { key: "done", title: "انجام‌شده", tone: "none" as Tone, items: completed },
    ].filter((group) => group.items.length > 0);
  }, [displayed, now]);

  const upcoming = useMemo(
    () =>
      [...pending]
        .filter((item) => Boolean(item.due_date))
        .sort(
          (a, b) =>
            (parseDue(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY) -
            (parseDue(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY)
        )
        .slice(0, 5),
    [pending]
  );

  const create = () => {
    if (!staff) return;
    router.push("/new-assignment");
  };

  const confirmDelete = (assignment: Assignment) => {
    Alert.alert(
      "حذف تکلیف",
      `«${assignment.title}» حذف شود؟ این کار قابل بازگشت نیست.`,
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => remove.mutate(assignment.id),
        },
      ]
    );
  };

  const refreshing = query.isRefetching;

  return (
    <Screen edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void query.refetch()}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        {/* header */}
        <Animated.View entering={FadeInDown.duration(320)} style={{ marginBottom: 16 }}>
          <Kicker text="assignments" dot style={{ marginBottom: 10 }} />
          <View style={styles.headerRow}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <AppText style={{ fontFamily: fonts.black, fontSize: 24, lineHeight: 33, letterSpacing: -0.4 }}>
                تکالیف و پروژه‌ها
              </AppText>
              <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
                مدیریت، زمان‌بندی و پیگیری تکالیف درسی
              </AppText>
            </View>

            {staff ? (
              <Pressable
                onPress={create}
                style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="افزودن تکالیف"
              >
                <View style={styles.addBadge}>
                  <Ionicons name="add" size={15} color={colors.white} />
                </View>
                <AppText
                  color={colors.black}
                  style={{ fontFamily: fonts.black, fontSize: 13, lineHeight: 19 }}
                >
                  افزودن تکالیف
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(320).delay(20)} style={{ marginBottom: 16 }}>
          <SchoolStatusStrip />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(360).delay(40)}>
          <WorkloadPanel items={all} now={now} />
          <SubjectsPanel items={all} />
          <ActivityPanel
            completed={completedCount}
            total={all.length}
            onPress={() => setFilter("all")}
          />
          <TypesPanel items={all} />
          <DeadlinesPanel
            items={upcoming}
            now={now}
            onOpen={(id) => router.push({ pathname: "/assignment/[id]", params: { id: String(id) } })}
          />
        </Animated.View>

        {/* toolbar */}
        <Panel corners contentStyle={styles.toolbar} style={{ marginBottom: 20 }}>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              {STATUS_FILTERS.map((option) => {
                const active = filter === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      if (active) return;
                      void Haptics.selectionAsync().catch(() => undefined);
                      setFilter(option.key);
                    }}
                    style={[styles.filterButton, active && styles.filterButtonActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <AppText
                      color={active ? colors.black : colors.faint}
                      style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 }}
                    >
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.badge}>
              <PulseDot size={5} tone={colors.white} glow={false} />
              <AppText color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
                {fmtNum(displayed.length)} ITEMS
              </AppText>
            </View>
          </View>

          <View style={styles.dropdownGrid}>
            <Pressable
              onPress={() => setSheet("category")}
              style={styles.dropdown}
              accessibilityRole="button"
              accessibilityLabel="فیلتر دسته‌بندی"
            >
              <Ionicons name="funnel-outline" size={15} color={colors.textSoft} />
              <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 12, flex: 1, textAlign: "right" }}>
                {CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "همه دسته‌ها"}
              </AppText>
              <Ionicons name="chevron-down" size={13} color={colors.faint} />
            </Pressable>

            <Pressable
              onPress={() => setSheet("subject")}
              style={styles.dropdown}
              accessibilityRole="button"
              accessibilityLabel="فیلتر درس"
            >
              <Ionicons name="book-outline" size={15} color={colors.textSoft} />
              <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 12, flex: 1, textAlign: "right" }}>
                {SUBJECT_OPTIONS.find((option) => option.value === subject)?.label ?? "همه درس‌ها"}
              </AppText>
              <Ionicons name="chevron-down" size={13} color={colors.faint} />
            </Pressable>

            <Pressable
              onPress={() => setSheet("sort")}
              style={styles.dropdown}
              accessibilityRole="button"
              accessibilityLabel="ترتیب نمایش"
            >
              <Ionicons name="swap-vertical" size={15} color={colors.textSoft} />
              <AppText numberOfLines={1} color={colors.textSoft} style={{ fontSize: 12, flex: 1, textAlign: "right" }}>
                {SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "جدیدترین"}
              </AppText>
              <Ionicons name="chevron-down" size={13} color={colors.faint} />
            </Pressable>

            <View style={styles.viewGroup}>
              {(
                [
                  { key: "grid" as ViewMode, icon: "grid-outline" as const, label: "نمایش شبکه‌ای" },
                  { key: "list" as ViewMode, icon: "list-outline" as const, label: "نمایش لیستی" },
                ]
              ).map((option) => {
                const active = view === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      setView(option.key);
                    }}
                    style={[styles.viewButton, active && styles.viewButtonActive]}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={active ? colors.black : colors.faint}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Panel>

        {/* list */}
        {query.isLoading && all.length === 0 ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.skeleton} />
            ))}
          </View>
        ) : query.isError && all.length === 0 ? (
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
        ) : displayed.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <Ionicons name="clipboard-outline" size={30} color={colors.faint} />
            <AppText align="center" color={colors.faint} style={{ fontSize: 14, lineHeight: 22 }}>
              {all.length === 0 ? "هنوز تکلیفی ثبت نشده" : "تکلیفی با این فیلترها پیدا نشد"}
            </AppText>
            {all.length === 0 && staff ? (
              <Pressable
                onPress={create}
                style={[styles.ghostButton, { marginTop: 4 }]}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={14} color={colors.textSoft} />
                <AppText color={colors.textSoft} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                  افزودن اولین تکلیف
                </AppText>
              </Pressable>
            ) : null}
          </Panel>
        ) : (
          <View style={{ gap: 28 }}>
            {groups.map((group) => (
              <View key={group.key}>
                <View style={styles.groupHead}>
                  <View style={[styles.groupDot, { backgroundColor: TONE_DOT[group.tone] }]} />
                  <AppText style={{ fontFamily: fonts.black, fontSize: 14, lineHeight: 20 }}>
                    {group.title}
                  </AppText>
                  <View style={styles.groupCount}>
                    <AppText ltr color={colors.faint} style={{ fontSize: 10, lineHeight: 14 }}>
                      {fmtNum(group.items.length)}
                    </AppText>
                  </View>
                  <View style={styles.groupRule} />
                </View>

                <View style={{ gap: 12 }}>
                  {group.items.map((item, index) => (
                    <Animated.View key={item.id} entering={FadeInDown.duration(240).delay(Math.min(index * 20, 120))}>
                      <AssignmentCard
                        assignment={item}
                        view={view}
                        now={now}
                        canManage={staff}
                        busy={toggle.isPending && toggle.variables === item.id}
                        onOpen={() =>
                          router.push({
                            pathname: "/assignment/[id]",
                            params: { id: String(item.id) },
                          })
                        }
                        onToggle={() => toggle.mutate(item.id)}
                        onEdit={() =>
                          router.push({
                            pathname: "/new-assignment",
                            params: { id: String(item.id) },
                          })
                        }
                        onDelete={() => confirmDelete(item)}
                      />
                    </Animated.View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {toast ? (
        <Animated.View
          key={toast}
          entering={FadeIn.duration(180)}
          style={[styles.toast, { bottom: tabBarReserve + insets.bottom + 12 }]}
          pointerEvents="none"
        >
          <AppText align="center" color="#fee2e2" style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 22 }}>
            {toast}
          </AppText>
        </Animated.View>
      ) : null}

      <SelectSheet
        visible={sheet === "category"}
        title="دسته‌بندی"
        options={CATEGORY_OPTIONS}
        value={category}
        onSelect={setCategory}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === "subject"}
        title="درس"
        options={SUBJECT_OPTIONS}
        value={subject}
        onSelect={setSubject}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === "sort"}
        title="ترتیب نمایش"
        options={SORT_OPTIONS}
        value={sort}
        onSelect={(value) => setSort(value as Sort)}
        onClose={() => setSheet(null)}
      />
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
  addButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: colors.white,
  },
  addBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },

  /* panels */
  panelPad: { padding: 16 },
  panelHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
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
  chartEmpty: { height: 132, alignItems: "center", justifyContent: "center" },
  axisRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  subjectsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  legendRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  legendDot: { width: 9, height: 9, borderRadius: 5 },

  activityTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  activityTrack: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  activityFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  activityLegend: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 14,
  },

  deadlineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deadlineDot: { width: 8, height: 8, borderRadius: 4 },

  /* toolbar */
  toolbar: { padding: 12, gap: 12 },
  filterRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  filterGroup: {
    flexDirection: "row-reverse",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 4,
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { backgroundColor: colors.white },
  dropdownGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  dropdown: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 10,
  },
  viewGroup: {
    flexDirection: "row-reverse",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 4,
  },
  viewButton: {
    width: 40,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonActive: { backgroundColor: colors.white },

  /* cards */
  listCard: {
    position: "relative",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(9,9,14,0.92)",
    paddingRight: 16,
    paddingLeft: 12,
    paddingVertical: 14,
    gap: 12,
    overflow: "hidden",
  },
  listEdge: {
    position: "absolute",
    top: 12,
    bottom: 12,
    right: 0,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  listTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
  },
  metaWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 4,
    marginTop: 4,
  },
  metaLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexShrink: 1,
  },
  creatorBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  listFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  countdownWrap: { flexDirection: "row-reverse", alignItems: "center" },
  chip: {
    maxWidth: 210,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  toggle: {
    minHeight: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleOpen: {
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  toggleDone: {
    borderColor: "rgba(52,211,153,0.30)",
    backgroundColor: "rgba(52,211,153,0.10)",
  },
  cardIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
  },
  stack: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderColor: colors.ink,
  },

  gridCard: {
    position: "relative",
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: "rgba(9,9,14,0.92)",
    padding: 16,
    paddingRight: 20,
    overflow: "hidden",
  },
  gridEdge: {
    position: "absolute",
    top: 16,
    bottom: 16,
    right: 0,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  gridHead: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  gridFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    marginTop: 12,
  },

  /* groups */
  groupHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupCount: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  groupRule: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.10)" },

  /* empty / error */
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyIconDanger: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.30)",
    backgroundColor: "rgba(248,113,113,0.10)",
  },
  primaryButton: {
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  ghostButton: {
    minHeight: 44,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },

  skeleton: {
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.40)",
    backgroundColor: "rgba(26,11,13,0.96)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
