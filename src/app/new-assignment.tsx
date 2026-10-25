import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, createAssignment, qk } from "@/api/client";
import { Button } from "@/components/Button";
import { EmptyState, GlassCard, SolidCard } from "@/components/cards";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Divider, Pill, type IconName } from "@/components/ui";
import { faDate, fmtNum, relativeDue } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import {
  CATEGORY_GROUPS,
  SUBJECT_LIST,
  categoryGroup,
  categoryItemLabel,
  type Subject,
} from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

type CategoryId = "homework" | "exam";

interface DuePreset {
  key: string;
  label: string;
  icon: IconName;
  days: number | null;
  hour?: number;
  minute?: number;
}

const DUE_PRESETS: DuePreset[] = [
  { key: "tonight", label: "امشب ۲۳:۵۹", icon: "moon-outline", days: 0, hour: 23, minute: 59 },
  { key: "tomorrow", label: "فردا ۱۴:۰۰", icon: "sunny-outline", days: 1, hour: 14, minute: 0 },
  { key: "two", label: "۲ روز بعد", icon: "calendar-outline", days: 2, hour: 14, minute: 0 },
  { key: "three", label: "۳ روز بعد", icon: "calendar-outline", days: 3, hour: 14, minute: 0 },
  { key: "week", label: "هفتهٔ بعد", icon: "calendar-number-outline", days: 7, hour: 14, minute: 0 },
];

function presetDate(preset: DuePreset): string {
  const date = new Date();
  date.setDate(date.getDate() + (preset.days ?? 0));
  date.setHours(preset.hour ?? 14, preset.minute ?? 0, 0, 0);
  return date.toISOString();
}

function SubjectRow({
  subject,
  onPress,
}: {
  subject: Subject | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.subjectRow}>
      <View style={styles.subjectIcon}>
        <Ionicons name="book-outline" size={18} color={colors.amber} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText
          variant="label"
          color={subject ? colors.text : colors.faint}
          style={{ fontFamily: fonts.semibold }}
        >
          {subject?.name ?? "یک درس انتخاب کن"}
        </AppText>
        <AppText variant="caption" color={colors.faint}>
          {subject ? `${subject.teacher} · ${subject.nameEn}` : "برای اتصال به برنامهٔ هفتگی"}
        </AppText>
      </View>
      <Ionicons name="chevron-back" size={14} color={colors.faint} />
    </Pressable>
  );
}

export default function NewAssignmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staff = isStaff(user);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [category, setCategory] = useState<CategoryId>("homework");
  const [subtype, setSubtype] = useState<string>("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [dueKey, setDueKey] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const group = categoryGroup(category);
  const subtypes = group?.items ?? [];

  useEffect(() => {
    if (titleTouched) return;
    if (subject && subtype) {
      setTitle(`${categoryItemLabel(subtype)} ${subject.name}`);
    } else {
      setTitle("");
    }
  }, [subject, subtype, titleTouched]);

  const changeCategory = (next: CategoryId) => {
    setCategory(next);
    const nextGroup = categoryGroup(next);
    setSubtype((current) =>
      nextGroup?.items.some((item) => item.id === current) ? current : ""
    );
  };

  const choosePreset = (preset: DuePreset) => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (dueKey === preset.key) {
      setDueKey(null);
      setDue(null);
      return;
    }
    setDueKey(preset.key);
    setDue(presetDate(preset));
  };

  const submit = () => {
    setError(null);
    if (!subject) {
      setError("درس تکلیف را انتخاب کن.");
      return;
    }
    if (!subtype) {
      setError("نوع تکلیف را انتخاب کن.");
      return;
    }
    if (!title.trim()) {
      setError("عنوان تکلیف نمی‌تواند خالی باشد.");
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        const created = await createAssignment({
          title: title.trim(),
          description: description.trim(),
          course: subject.name,
          category,
          subtype,
          subject_id: subject.id,
          due_date: due,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
        queryClient.setQueryData(qk.assignment(created.id), created);
        await queryClient.invalidateQueries({ queryKey: qk.assignments });
        void queryClient.invalidateQueries({ queryKey: qk.overview });
        void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
        router.back();
      } catch (submitError) {
        setError(
          submitError instanceof ApiError
            ? submitError.message
            : "ساخت تکلیف انجام نشد. دوباره تلاش کن."
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  if (!staff) {
    return (
      <Screen edges={["top", "bottom"]}>
        <Header title="تکلیف تازه" onBack={() => router.back()} />
        <EmptyState
          icon="lock-closed-outline"
          title="دسترسی مدیریتی لازم است"
          hint="فقط ادمین و Owner می‌توانند تکلیف بسازند."
          actionLabel="بازگشت"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <Header
        title="تکلیف تازه"
        subtitle="برای همهٔ اعضای کلاس منتشر می‌شود"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(360)}>
            <GlassCard contentStyle={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.stepBadge}>
                  <AppText variant="caption" color={colors.amber} ltr style={{ fontFamily: fonts.bold }}>
                    01
                  </AppText>
                </View>
                <AppText variant="subtitle">درس و نوع</AppText>
              </View>

              <SubjectRow subject={subject} onPress={() => setSubjectOpen(true)} />

              <Segmented<CategoryId>
                value={category}
                onChange={changeCategory}
                options={CATEGORY_GROUPS.map((entry) => ({
                  key: entry.id as CategoryId,
                  label: entry.label,
                }))}
              />

              <View style={styles.chips}>
                {subtypes.map((item) => {
                  const active = subtype === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        void Haptics.selectionAsync().catch(() => undefined);
                        setSubtype(item.id);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <AppText
                        variant="caption"
                        color={active ? colors.amber : colors.muted}
                        style={{ fontFamily: active ? fonts.semibold : fonts.regular }}
                      >
                        {item.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(360)}>
            <GlassCard contentStyle={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.stepBadge}>
                  <AppText variant="caption" color={colors.amber} ltr style={{ fontFamily: fonts.bold }}>
                    02
                  </AppText>
                </View>
                <AppText variant="subtitle">مهلت تحویل</AppText>
                {due ? <Pill label={relativeDue(due)} tone="amber" /> : null}
              </View>

              <View style={styles.chips}>
                {DUE_PRESETS.map((preset) => {
                  const active = dueKey === preset.key;
                  return (
                    <Pressable
                      key={preset.key}
                      onPress={() => choosePreset(preset)}
                      style={[styles.dueChip, active && styles.dueChipActive]}
                    >
                      <Ionicons
                        name={preset.icon}
                        size={14}
                        color={active ? colors.amber : colors.faint}
                      />
                      <AppText
                        variant="caption"
                        color={active ? colors.amber : colors.muted}
                        style={{ fontFamily: active ? fonts.semibold : fonts.regular }}
                      >
                        {preset.label}
                      </AppText>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => {
                    setDueKey(null);
                    setDue(null);
                  }}
                  style={[styles.dueChip, !due && styles.dueChipActive]}
                >
                  <Ionicons
                    name="infinite-outline"
                    size={14}
                    color={!due ? colors.amber : colors.faint}
                  />
                  <AppText
                    variant="caption"
                    color={!due ? colors.amber : colors.muted}
                    style={{ fontFamily: !due ? fonts.semibold : fonts.regular }}
                  >
                    بدون مهلت
                  </AppText>
                </Pressable>
              </View>

              {due ? (
                <SolidCard style={styles.dueSummary}>
                  <Ionicons name="alarm-outline" size={15} color={colors.amber} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <AppText variant="caption" color={colors.text} style={{ fontFamily: fonts.medium }}>
                      {faDate(due, "weekdayTime")}
                    </AppText>
                    <AppText variant="caption" color={colors.faint}>
                      {relativeDue(due)}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => {
                      setDueKey(null);
                      setDue(null);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={17} color={colors.faint} />
                  </Pressable>
                </SolidCard>
              ) : (
                <AppText variant="caption" color={colors.faint}>
                  بدون مهلت، تکلیف در بخش «پیشِ رو» می‌ماند و اعلان سررسید ندارد.
                </AppText>
              )}

              <View style={styles.antiCheat}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.teal} />
                <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
                  اعضا تا ۳۰ دقیقه پس از انتشار نمی‌توانند «انجام شد» بزنند.
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(360)}>
            <GlassCard contentStyle={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.stepBadge}>
                  <AppText variant="caption" color={colors.amber} ltr style={{ fontFamily: fonts.bold }}>
                    03
                  </AppText>
                </View>
                <AppText variant="subtitle">جزئیات</AppText>
              </View>

              <Field
                label="عنوان"
                value={title}
                onChangeText={(value) => {
                  setTitleTouched(true);
                  setTitle(value);
                }}
                placeholder="مثلاً تحقیق طراحی وب"
                maxLength={200}
                hint={
                  titleTouched
                    ? undefined
                    : "خودکار از نوع و درس ساخته می‌شود؛ می‌توانی تغییرش بدهی."
                }
              />

              <Field
                label="توضیح (اختیاری)"
                value={description}
                onChangeText={setDescription}
                placeholder="جزئیات، صفحه‌ها یا نکته‌های مهم…"
                multiline
                maxLength={1000}
              />

              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Ionicons name="book-outline" size={13} color={colors.faint} />
                  <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                    {subject?.name ?? "بدون درس"}
                  </AppText>
                  <AppText variant="caption" color={colors.faint}>
                    {group?.label ?? "—"}
                    {subtype ? ` · ${categoryItemLabel(subtype)}` : ""}
                  </AppText>
                </View>
                <Divider />
                <View style={styles.summaryRow}>
                  <Ionicons name="notifications-outline" size={13} color={colors.faint} />
                  <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                    اعلان فوری برای همهٔ اعضا
                  </AppText>
                  <AppText variant="caption" color={colors.faint}>
                    push
                  </AppText>
                </View>
              </View>

              <View style={styles.attachmentNote}>
                <Ionicons name="attach-outline" size={14} color={colors.blue} />
                <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
                  پیوست فایل فعلاً از نسخهٔ وب اضافه می‌شود؛ تکلیف همان‌جا قابل ویرایش است.
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={colors.red} />
              <AppText variant="caption" color={colors.red} style={{ flex: 1 }}>
                {error}
              </AppText>
            </View>
          ) : null}
          <Button
            label="انتشار تکلیف"
            icon="send-outline"
            onPress={submit}
            loading={saving}
          />
          <AppText variant="caption" color={colors.faint} align="center">
            {subject && subtype
              ? `${subject.name} · ${categoryItemLabel(subtype)}`
              : "درس و نوع را کامل کن"}
            {due ? ` · ${faDate(due, "short")}` : ""}
          </AppText>
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={subjectOpen}
        onClose={() => setSubjectOpen(false)}
        title="انتخاب درس"
        subtitle={`${fmtNum(SUBJECT_LIST.length)} درس کلاس یازدهم`}
      >
        {SUBJECT_LIST.map((entry, index) => {
          const active = subject?.id === entry.id;
          return (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => {
                  setSubject(entry);
                  setSubjectOpen(false);
                  void Haptics.selectionAsync().catch(() => undefined);
                }}
                style={styles.subjectOption}
              >
                <Avatar name={entry.name} size="xs" />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <AppText
                    variant="label"
                    color={active ? colors.amber : colors.text}
                    style={{ fontFamily: active ? fonts.semibold : fonts.medium }}
                    numberOfLines={1}
                  >
                    {entry.name}
                  </AppText>
                  <AppText variant="caption" color={colors.faint} numberOfLines={1}>
                    {entry.teacher} · {entry.nameEn}
                  </AppText>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.amber} />
                ) : (
                  <Ionicons name="ellipse-outline" size={16} color={colors.faint} />
                )}
              </Pressable>
            </View>
          );
        })}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  card: { padding: spacing.lg, gap: spacing.sm },
  cardHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  stepBadge: {
    width: 26,
    height: 22,
    borderRadius: radius.xs,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  subjectRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  subjectIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  chips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  chipActive: {
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  dueChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  dueChipActive: {
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  dueSummary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: "rgba(242,180,85,0.06)",
    borderColor: colors.amberLine,
  },
  antiCheat: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  summary: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  attachmentNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.inkRaised,
  },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: "rgba(242,104,107,0.3)",
  },
  subjectOption: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 9,
  },
});
