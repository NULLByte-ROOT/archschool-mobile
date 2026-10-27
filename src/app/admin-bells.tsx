import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  fetchSchoolSchedule,
  qk,
  updateSchoolSchedule,
} from "@/api/client";
import type { SchoolPeriod } from "@/api/types";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { MonoLabel, Panel } from "@/components/webui";
import { formatClock, timeToMinutes } from "@/lib/bell";
import { fmtNum } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
} from "@/theme/tokens";

/** The backend's default day, mirrored from `bell.py` + `schedule.py`. */
const DEFAULT_TIMES: ReadonlyArray<readonly [string, string]> = [
  ["08:00", "09:30"],
  ["09:30", "11:00"],
  ["11:00", "12:30"],
  ["12:30", "14:00"],
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Row {
  start: string;
  end: string;
}

const defaultRows = (): Row[] =>
  DEFAULT_TIMES.map(([start, end]) => ({ start, end }));

/** Accept `8:5` / `۰۸:۰۰` and hand back the exact `HH:MM` the API validates. */
function normalize(value: string): string {
  const latin = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(latin);
  if (!match) return latin;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

interface Check {
  periods: SchoolPeriod[] | null;
  fieldErrors: Record<string, string>;
  error: string | null;
}

/** Mirrors `_validate()` in `backend/app/routers/schedule.py`. */
function check(rows: Row[]): Check {
  const fieldErrors: Record<string, string> = {};
  const periods: SchoolPeriod[] = [];

  rows.forEach((row, index) => {
    const start = timeToMinutes(normalize(row.start));
    const end = timeToMinutes(normalize(row.end));
    if (!Number.isFinite(start)) {
      fieldErrors[`${index}-start`] = "HH:MM مثل 08:00";
    }
    if (!Number.isFinite(end)) {
      fieldErrors[`${index}-end`] = "HH:MM مثل 09:30";
    }
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      fieldErrors[`${index}-end`] = "پایان باید بعد از شروع باشد";
    }
    periods.push({
      period_number: index + 1,
      start_time: normalize(row.start),
      end_time: normalize(row.end),
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { periods: null, fieldErrors, error: "زمان‌ها را درست کن." };
  }

  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const current = periods[index];
    if (timeToMinutes(current.start_time) < timeToMinutes(previous.end_time)) {
      return {
        periods: null,
        fieldErrors: { [`${index}-start`]: "با پایان زنگ قبل هم‌پوشانی دارد" },
        error: `زنگ ${fmtNum(index + 1)} با زنگ ${fmtNum(index)} هم‌پوشانی دارد.`,
      };
    }
  }

  return { periods, fieldErrors: {}, error: null };
}

function minutesOf(start: string, end: string): number | null {
  const from = timeToMinutes(normalize(start));
  const to = timeToMinutes(normalize(end));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return to - from;
}

export default function AdminBellsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staff = isStaff(user);

  const schedule = useQuery({
    queryKey: qk.schedule,
    queryFn: fetchSchoolSchedule,
    enabled: staff,
    staleTime: 0,
  });

  const [rows, setRows] = useState<Row[]>(defaultRows);
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the inputs from the server once; never fight the user's typing.
  useEffect(() => {
    if (touched || !schedule.data) return;
    const byNumber = new Map(
      schedule.data.periods.map((period) => [period.period_number, period])
    );
    setRows(
      DEFAULT_TIMES.map(([start, end], index) => {
        const period = byNumber.get(index + 1);
        return {
          start: period?.start_time ?? start,
          end: period?.end_time ?? end,
        };
      })
    );
  }, [schedule.data, touched]);

  const setCell = (index: number, key: keyof Row, value: string) => {
    setTouched(true);
    setMessage(null);
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      )
    );
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${index}-${key}`];
      return next;
    });
  };

  const resetToDefaults = () => {
    setRows(defaultRows());
    setTouched(true);
    setFieldErrors({});
    setError(null);
    setMessage("زمان‌های پیش‌فرض بارگذاری شد؛ برای اعمال، «ذخیره» را بزن.");
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const save = async () => {
    if (saving) return;
    const result = check(rows);
    setFieldErrors(result.fieldErrors);
    setError(result.error);
    if (!result.periods) {
      setMessage(null);
      return;
    }

    setSaving(true);
    try {
      const saved = await updateSchoolSchedule(result.periods);
      // Paint every countdown right now (`SchoolStatusCard`, Today's Schedule,
      // assignment deadlines), then let the active queries re-fetch in the
      // background so nothing keeps the old bell times.
      queryClient.setQueryData(qk.schedule, saved);
      await queryClient.invalidateQueries({ queryKey: qk.schedule });
      setRows(
        saved.periods
          .slice()
          .sort((a, b) => a.period_number - b.period_number)
          .map((period) => ({
            start: period.start_time,
            end: period.end_time,
          }))
      );
      setTouched(false);
      setMessage("زنگ‌ها ذخیره شد. شمارش معکوس‌ها به‌روز شدند.");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => undefined);
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : "ذخیرهٔ زنگ‌ها انجام نشد. دوباره تلاش کن."
      );
      setMessage(null);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  if (!staff) {
    return (
      <Screen edges={["top"]}>
        <Header
          title="تنظیمات زنگ‌ها"
          subtitle="// ADMIN"
          onBack={() => router.back()}
        />
        <View style={styles.blocked}>
          <Panel corners contentStyle={styles.blockedPanel}>
            <Ionicons name="lock-closed" size={26} color={colors.faint} />
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 }}>
              دسترسی ندارید
            </AppText>
            <AppText
              align="center"
              color={colors.faint}
              style={{ fontSize: 11.5, lineHeight: 18 }}
            >
              این صفحه فقط برای ادمین و مالک باز است.
            </AppText>
          </Panel>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <Header
        title="تنظیمات زنگ‌ها"
        subtitle="// ADMIN · SCHOOL BELLS"
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          <Panel corners contentStyle={styles.panelPad} style={{ marginBottom: 16 }}>
            <MonoLabel>// BELLS</MonoLabel>
            <AppText
              style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, marginTop: 2 }}
            >
              چهار زنگ روزانه
            </AppText>
            <AppText
              color={colors.faint}
              style={{ fontSize: 11, lineHeight: 18, marginTop: 2, marginBottom: 14 }}
            >
              هم‌اکنون این ساعت‌ها همین دستگاه را می‌بینند؛ پس از ذخیره، همهٔ
              شمارش معکوس‌ها فوراً به‌روز می‌شوند.
            </AppText>

            {schedule.isLoading ? (
              <View style={styles.loading}>
                <AppText color={colors.faint} style={{ fontSize: 11.5 }}>
                  در حال خواندن زنگ‌ها…
                </AppText>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {rows.map((row, index) => {
                  const length = minutesOf(row.start, row.end);
                  return (
                    <View key={`bell-${index}`} style={styles.bellCard}>
                      <View style={styles.bellHead}>
                        <View style={styles.numberChip}>
                          <AppText ltr style={styles.numberChipText}>
                            {fmtNum(index + 1)}
                          </AppText>
                        </View>
                        <AppText
                          style={{ fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 19 }}
                        >
                          زنگ {fmtNum(index + 1)}
                        </AppText>
                        <View style={{ flex: 1 }} />
                        <AppText
                          ltr
                          color={colors.faint}
                          style={{ fontSize: 10, lineHeight: 15, fontVariant: ["tabular-nums"] }}
                        >
                          {length
                            ? `${formatClock(timeToMinutes(normalize(row.start)))} → ${formatClock(
                                timeToMinutes(normalize(row.end))
                              )}`
                            : "—"}
                        </AppText>
                      </View>

                      <View style={styles.fields}>
                        <View style={{ flex: 1 }}>
                          <Field
                            label="شروع"
                            value={row.start}
                            onChangeText={(value) => setCell(index, "start", value)}
                            placeholder="08:00"
                            ltr
                            maxLength={5}
                            keyboardType="numbers-and-punctuation"
                            error={fieldErrors[`${index}-start`]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Field
                            label="پایان"
                            value={row.end}
                            onChangeText={(value) => setCell(index, "end", value)}
                            placeholder="09:30"
                            ltr
                            maxLength={5}
                            keyboardType="numbers-and-punctuation"
                            error={fieldErrors[`${index}-end`]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Panel>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <AppText color={colors.danger} style={styles.bannerText}>
                {error}
              </AppText>
            </View>
          ) : null}

          {message ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <AppText color={colors.emeraldPale} style={styles.bannerText}>
                {message}
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Button
              label={saving ? "در حال ذخیره…" : "ذخیره"}
              icon="save-outline"
              onPress={() => void save()}
              loading={saving}
            />
            <Button
              label="بازگشت به پیش‌فرض"
              icon="refresh-outline"
              variant="ghost"
              onPress={resetToDefaults}
              disabled={saving}
            />
          </View>

          <AppText
            align="center"
            color={colors.faint}
            style={{ fontSize: 10.5, lineHeight: 17, marginTop: 14 }}
          >
            پیش‌فرض: 08:00–09:30 · 09:30–11:00 · 11:00–12:30 · 12:30–14:00
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xs },
  panelPad: { padding: 16 },
  loading: { paddingVertical: 24, alignItems: "center" },

  bellCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    padding: 12,
    gap: 10,
  },
  bellHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  numberChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  numberChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
  },
  fields: { flexDirection: "row-reverse", gap: 10 },

  errorBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.successLine,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 18 },

  blocked: { flex: 1, paddingHorizontal: screenGutter, paddingTop: 40 },
  blockedPanel: { alignItems: "center", gap: 8, paddingVertical: 40 },
});
