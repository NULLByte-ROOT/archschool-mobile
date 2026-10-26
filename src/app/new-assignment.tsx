import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  createAssignment,
  fetchAssignment,
  qk,
  updateAssignment,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { SelectSheet, type SelectOption } from "@/components/SelectSheet";
import { Sheet } from "@/components/Sheet";
import { AppText } from "@/components/ui";
import { IconTile, Kicker, MonoLabel, Panel } from "@/components/webui";
import {
  dateAt,
  defaultDueForSubject,
  weekOffsetOf,
  WEEK_DAYS,
  SUBJECT_DAY,
} from "@/lib/due";
import { faDate, formatDue, parseDue, relativeDue, dueColor, dueTone } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import {
  CATEGORY_GROUPS,
  SUBJECT_LIST,
  categoryGroup,
  categoryItemLabel,
  subjectName,
} from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

const WEEK_LABELS = ["این هفته", "هفته بعد", "۲ هفته بعد", "۳ هفته بعد"];

const CATEGORY_OPTIONS: SelectOption[] = CATEGORY_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    value: item.id,
    label: item.label,
    description: group.label,
  }))
);

const SUBJECT_OPTIONS: SelectOption[] = SUBJECT_LIST.map((subject) => ({
  value: subject.id,
  label: subject.name,
  description: `${subject.nameEn} · ${subject.teacher}`,
}));

/* ------------------------------------------------------------------ */
/* field shells — the web `Dropdown` / `DueDatePicker` triggers        */
/* ------------------------------------------------------------------ */

function FieldTrigger({
  icon,
  value,
  hint,
  placeholder,
  tone,
  open,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value?: string;
  hint?: string;
  placeholder: string;
  tone?: string;
  open?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        open && styles.triggerOpen,
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
    >
      <IconTile name={icon} size={36} iconSize={17} tone={colors.faint} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <AppText
          numberOfLines={1}
          color={value ? colors.white : colors.faint}
          style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 }}
        >
          {value ?? placeholder}
        </AppText>
        {hint ? (
          <AppText
            numberOfLines={1}
            color={tone ?? colors.faint}
            style={{ fontSize: 10.5, lineHeight: 15 }}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-down" size={14} color={colors.faint} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* screen                                                              */
/* ------------------------------------------------------------------ */

export default function NewAssignmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staff = isStaff(user);

  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const editing = editId !== null && Number.isFinite(editId);

  const [subtype, setSubtype] = useState("");
  const [category, setCategory] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  const [subjectOpen, setSubjectOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [viewWeek, setViewWeek] = useState(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!editing);

  const existing = useQuery({
    queryKey: qk.assignment(editId ?? 0),
    queryFn: () => fetchAssignment(editId as number),
    enabled: editing,
  });

  useEffect(() => {
    const data = existing.data;
    if (!data || hydrated) return;
    setSubtype(data.subtype ?? "");
    setCategory(data.category ?? "");
    setSubjectId(data.subject_id ?? "");
    setDue(data.due_date ?? null);
    setTitle(data.title ?? "");
    setTitleTouched(true);
    if (data.due_date) {
      const parsed = parseDue(data.due_date);
      if (parsed) setViewWeek(Math.max(0, Math.min(3, weekOffsetOf(parsed))));
    }
    setHydrated(true);
  }, [existing.data, hydrated]);

  const autoTitle = useMemo(
    () =>
      subtype && subjectId
        ? `${categoryItemLabel(subtype)} ${subjectName(subjectId)}`
        : "",
    [subtype, subjectId]
  );

  const selectedSubject = SUBJECT_LIST.find((subject) => subject.id === subjectId);
  const groupLabel = categoryGroup(category)?.label;
  const canSubmit = Boolean(subtype && category && subjectId) && !saving;

  const chooseSubtype = (value: string) => {
    const group = CATEGORY_GROUPS.find((entry) =>
      entry.items.some((item) => item.id === value)
    );
    setSubtype(value);
    setCategory(group?.id ?? "");
  };

  const chooseSubject = (value: string) => {
    setSubjectId(value);
    const preset = defaultDueForSubject(value);
    if (preset) {
      setDue(preset.toISOString());
      setViewWeek(Math.max(0, Math.min(3, weekOffsetOf(preset))));
    }
  };

  const submit = () => {
    setError(null);
    if (!category || !subtype) {
      setError("موضوع تکلیف را انتخاب کن.");
      return;
    }
    if (!subjectId) {
      setError("درس تکلیف را انتخاب کن.");
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        const payload = {
          title: title.trim() || autoTitle || categoryItemLabel(subtype),
          course: subjectName(subjectId),
          subject_id: subjectId,
          category,
          subtype,
          due_date: due,
        };
        const saved = editing
          ? await updateAssignment(editId as number, payload)
          : await createAssignment(payload);

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
        queryClient.setQueryData(qk.assignment(saved.id), saved);
        await queryClient.invalidateQueries({ queryKey: qk.assignments });
        void queryClient.invalidateQueries({ queryKey: qk.overview });
        void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
        router.back();
      } catch (submitError) {
        setError(
          submitError instanceof ApiError
            ? submitError.message
            : editing
              ? "ذخیرهٔ تغییرات انجام نشد. دوباره تلاش کن."
              : "ساخت تکلیف انجام نشد. دوباره تلاش کن."
        );
        setSaving(false);
      }
    })();
  };

  if (!staff) {
    return (
      <Screen edges={["top", "bottom"]}>
        <View style={styles.denied}>
          <IconTile name="lock-closed-outline" size={44} iconSize={20} tone={colors.faint} />
          <AppText style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 }}>
            دسترسی مدیریتی لازم است
          </AppText>
          <AppText align="center" color={colors.faint} style={{ fontSize: 12, lineHeight: 20 }}>
            فقط ادمین و Owner می‌توانند تکلیف بسازند.
          </AppText>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
              بازگشت
            </AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tabBarReserve + insets.bottom + 96 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* header */}
          <Animated.View entering={FadeInDown.duration(180)} style={{ marginBottom: 16 }}>
            <Kicker
              text={editing ? "edit assignment" : "new assignment"}
              dot
              style={{ marginBottom: 10 }}
            />

            <View style={styles.headerRow}>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
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
                    {editing ? "ویرایش تکلیف" : "افزودن تکلیف"}
                  </AppText>
                </View>
                <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
                  {editing
                    ? "تغییرها برای همهٔ اعضای کلاس اعمال می‌شود"
                    : "برای همهٔ اعضای کلاس منتشر می‌شود"}
                </AppText>
              </View>

              <IconTile
                name={editing ? "create-outline" : "add"}
                size={44}
                iconSize={19}
                tone={colors.white}
              />
            </View>
          </Animated.View>

          {editing && existing.isLoading && !hydrated ? (
            <Panel corners contentStyle={styles.loadingBox}>
              <ActivityIndicator color={colors.textSoft} />
              <AppText color={colors.faint} style={{ fontSize: 12 }}>
                در حال بارگذاری…
              </AppText>
            </Panel>
          ) : (
            <Animated.View entering={FadeInDown.duration(180).delay(20)}>
              <Panel corners contentStyle={styles.panelPad}>
                {/* موضوع */}
                <View style={{ marginBottom: 16 }}>
                  <MonoLabel style={{ marginBottom: 8 }}>موضوع</MonoLabel>
                  <FieldTrigger
                    icon="clipboard-outline"
                    value={subtype ? categoryItemLabel(subtype) : undefined}
                    hint={groupLabel}
                    placeholder="موضوع"
                    open={categoryOpen}
                    onPress={() => setCategoryOpen(true)}
                  />
                </View>

                {/* درس */}
                <View style={{ marginBottom: 16 }}>
                  <MonoLabel style={{ marginBottom: 8 }}>درس</MonoLabel>
                  <FieldTrigger
                    icon="book-outline"
                    value={selectedSubject?.name}
                    hint={
                      selectedSubject
                        ? `${selectedSubject.nameEn} · ${selectedSubject.teacher}`
                        : undefined
                    }
                    placeholder="انتخاب درس"
                    open={subjectOpen}
                    onPress={() => setSubjectOpen(true)}
                  />
                </View>

                {/* مهلت تحویل */}
                <View style={{ marginBottom: 16 }}>
                  <MonoLabel style={{ marginBottom: 8 }}>مهلت تحویل</MonoLabel>
                  <FieldTrigger
                    icon="calendar-outline"
                    value={due ? formatDue(due) : undefined}
                    hint={due ? relativeDue(due) : "بدون مهلت"}
                    tone={due ? dueColor(dueTone(due)) : undefined}
                    placeholder="انتخاب مهلت…"
                    open={dueOpen}
                    onPress={() => {
                      if (due) {
                        const parsed = parseDue(due);
                        if (parsed) {
                          setViewWeek(Math.max(0, Math.min(3, weekOffsetOf(parsed))));
                        }
                      }
                      setDueOpen(true);
                    }}
                  />
                </View>

                {/* عنوان */}
                <View>
                  <MonoLabel style={{ marginBottom: 8 }}>عنوان (اختیاری)</MonoLabel>
                  <View style={styles.inputShell}>
                    <Ionicons name="pencil-outline" size={15} color={colors.faint} />
                    <TextInput
                      value={title}
                      onChangeText={(value) => {
                        setTitleTouched(true);
                        setTitle(value);
                      }}
                      placeholder={autoTitle || "مثلاً: حل تمرین‌های فصل ۳"}
                      placeholderTextColor={colors.faint}
                      selectionColor={colors.amber}
                      cursorColor={colors.amber}
                      maxLength={200}
                      style={styles.input}
                      accessibilityLabel="عنوان تکلیف"
                    />
                  </View>
                  {!titleTouched && autoTitle ? (
                    <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 17, marginTop: 6 }}>
                      خالی بگذاری، همین عنوان ثبت می‌شود.
                    </AppText>
                  ) : null}
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <AppText color={colors.danger} style={{ fontSize: 11.5, lineHeight: 18, flex: 1 }}>
                      {error}
                    </AppText>
                  </View>
                ) : null}
              </Panel>

              <View style={styles.antiCheat}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
                <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 17, flex: 1 }}>
                  اعضا تا ۳۰ دقیقه پس از انتشار نمی‌توانند «انجام شد» بزنند. پیوست فایل از نسخهٔ
                  وب اضافه می‌شود.
                </AppText>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* footer */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 12.5 }}>
              انصراف
            </AppText>
          </Pressable>

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit && { opacity: 0.45 },
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={editing ? "ذخیره تغییرات" : "ثبت تکلیف"}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <View style={styles.primaryBadge}>
                <Ionicons name={editing ? "pencil" : "add"} size={14} color={colors.white} />
              </View>
            )}
            <AppText color={colors.black} style={{ fontFamily: fonts.black, fontSize: 13 }}>
              {saving ? "ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت تکلیف"}
            </AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* subject picker */}
      <SelectSheet
        visible={subjectOpen}
        title="انتخاب درس"
        options={SUBJECT_OPTIONS}
        value={subjectId}
        onSelect={chooseSubject}
        onClose={() => setSubjectOpen(false)}
      />

      {/* category picker */}
      <SelectSheet
        visible={categoryOpen}
        title="موضوع"
        options={CATEGORY_OPTIONS}
        value={subtype}
        onSelect={chooseSubtype}
        onClose={() => setCategoryOpen(false)}
      />

      {/* due date picker */}
      <Sheet
        visible={dueOpen}
        onClose={() => setDueOpen(false)}
        title="مهلت را انتخاب کنید"
        subtitle="روزِ مورد نظر را از هفته‌ی زیر برگزینید"
      >
        <View style={styles.weekGrid}>
          {WEEK_DAYS.map((day) => {
            const date = dateAt(viewWeek, day.index);
            const selected = due ? sameDay(date, parseDue(due)) : false;
            const subjectDay = subjectId ? SUBJECT_DAY[subjectId] : undefined;

            return (
              <Pressable
                key={day.id}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setDue(date.toISOString());
                  setDueOpen(false);
                }}
                style={[styles.dayCell, selected && styles.dayCellActive]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${day.name} ${faDate(date, "dayMonth")}`}
              >
                <AppText
                  color={selected ? colors.black : colors.text}
                  style={{ fontFamily: fonts.black, fontSize: 12.5, lineHeight: 18 }}
                >
                  {day.name}
                </AppText>
                <AppText
                  ltr
                  color={selected ? "rgba(0,0,0,0.60)" : colors.faint}
                  style={{ fontSize: 10, lineHeight: 14, fontVariant: ["tabular-nums"] }}
                >
                  {faDate(date, "dayMonth")}
                </AppText>
                {subjectDay === day.index ? (
                  <View
                    style={[
                      styles.subjectDot,
                      { backgroundColor: selected ? "rgba(0,0,0,0.50)" : "rgba(255,255,255,0.70)" },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.weekChips}>
          {WEEK_LABELS.map((label, index) => {
            const active = viewWeek === index;
            return (
              <Pressable
                key={label}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setViewWeek(index);
                }}
                style={[styles.weekChip, active && styles.weekChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText
                  color={active ? colors.black : colors.faint}
                  style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 }}
                >
                  {index === 1 ? `✦ ${label}` : label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dueFoot}>
          <View style={styles.legend}>
            <View style={styles.legendDot} />
            <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 15 }}>
              روزِ همین درس در برنامهٔ هفتگی
            </AppText>
          </View>

          <Pressable
            onPress={() => {
              setDue(null);
              setDueOpen(false);
            }}
            style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 11.5 }}>
              بدون مهلت
            </AppText>
          </Pressable>
        </View>
      </Sheet>
    </Screen>
  );
}

function sameDay(a: Date, b: Date | null): boolean {
  if (!b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
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

  /* panel */
  panelPad: { padding: 16 },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },

  /* triggers */
  trigger: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  triggerOpen: {
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(0,0,0,0.70)",
  },
  inputShell: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 0,
  },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
  },
  antiCheat: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 12,
    paddingHorizontal: 4,
  },

  /* footer */
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.white12,
    backgroundColor: "rgba(6,6,8,0.96)",
  },
  ghostButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  primaryButton: {
    flex: 1.4,
    minHeight: 46,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: colors.white,
  },
  primaryBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },

  /* due sheet */
  weekGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  dayCell: {
    flexBasis: "18%",
    flexGrow: 1,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  dayCellActive: {
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  subjectDot: {
    position: "absolute",
    top: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
  },
  weekChip: {
    flexBasis: "47%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    borderRadius: radius.pill,
  },
  weekChipActive: {
    backgroundColor: colors.white,
  },
  dueFoot: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  legend: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.70)",
  },

  /* denied */
  denied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
});
