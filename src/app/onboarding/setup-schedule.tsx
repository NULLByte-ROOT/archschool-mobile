import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SchoolPeriod } from "@/api/types";
import { offlineDb } from "@/lib/offlineDb";
import { SUBJECT_LIST } from "@/lib/subjects";
import { TIMETABLE, type Day } from "@/lib/timetable";
import { colors } from "@/theme/tokens";

const DEFAULT_PERIODS: SchoolPeriod[] = [
  { period_number: 1, start_time: "08:00", end_time: "09:30" },
  { period_number: 2, start_time: "09:30", end_time: "11:00" },
  { period_number: 3, start_time: "11:00", end_time: "12:30" },
  { period_number: 4, start_time: "12:30", end_time: "14:00" },
];

export default function SetupSchedule() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPadding = Math.max(insets.top, 24) + 16;
  const bottomPadding = Math.max(insets.bottom, 16) + 24;

  const [periods, setPeriods] = useState<SchoolPeriod[]>(DEFAULT_PERIODS);
  const [timetable, setTimetable] = useState<Day[]>(TIMETABLE);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [activePeriodIdx, setActivePeriodIdx] = useState(0);

  const activeDay = timetable[activeDayIdx];

  const updatePeriodTime = (idx: number, field: "start_time" | "end_time", val: string) => {
    const next = [...periods];
    next[idx] = { ...next[idx], [field]: val };
    setPeriods(next);
  };

  const selectSubjectForPeriod = async (subjectId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextTimetable = JSON.parse(JSON.stringify(timetable)) as Day[];
    const day = nextTimetable[activeDayIdx];

    // Ensure day has 4 cells
    let expanded: { kind: "class"; span: number; subjectId: string }[] = [];
    for (const cell of day.cells) {
      if (cell.kind === "class") {
        for (let s = 0; s < cell.span; s++) {
          expanded.push({ kind: "class", span: 1, subjectId: cell.subjectId });
        }
      } else {
        for (let s = 0; s < cell.span; s++) {
          expanded.push({ kind: "class", span: 1, subjectId: "free" });
        }
      }
    }
    while (expanded.length < 4) {
      expanded.push({ kind: "class", span: 1, subjectId: "free" });
    }

    expanded[activePeriodIdx] = { kind: "class", span: 1, subjectId };
    day.cells = expanded;
    setTimetable(nextTimetable);

    // Auto advance to next period or day
    if (activePeriodIdx < 3) {
      setActivePeriodIdx((prev) => prev + 1);
    } else if (activeDayIdx < timetable.length - 1) {
      setActiveDayIdx((prev) => prev + 1);
      setActivePeriodIdx(0);
    }
  };

  const handleSaveAndContinue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await offlineDb.saveSchedule(periods);
    await offlineDb.saveTimetable(timetable);
    router.replace("/onboarding/setup-class");
  };

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPadding, paddingBottom: bottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>برنامه مدرسه و زنگ‌ها</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Prompt */}
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text style={styles.mainTitle}>ساعت زنگ‌ها و برنامه درسی</Text>
          <Text style={styles.subTitle}>
            ساعت شروع و پایان زنگ‌ها را بررسی کنید و دروس هر روز را با یک لمس مشخص کنید.
          </Text>
        </Animated.View>

        {/* Section 1: Bell Periods */}
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text style={styles.sectionTitle}>ساعت زنگ‌های مدرسه (۴ زنگ)</Text>
        </View>

        <View style={styles.periodsGrid}>
          {periods.map((p, idx) => (
            <View key={p.period_number} style={styles.periodCard}>
              <Text style={styles.periodLabel}>زنگ {p.period_number}</Text>
              <View style={styles.timeInputsRow}>
                <TextInput
                  value={p.start_time}
                  onChangeText={(v) => updatePeriodTime(idx, "start_time", v)}
                  style={styles.timeInput}
                  placeholder="08:00"
                  placeholderTextColor={colors.faint}
                />
                <Text style={styles.timeSep}>تا</Text>
                <TextInput
                  value={p.end_time}
                  onChangeText={(v) => updatePeriodTime(idx, "end_time", v)}
                  style={styles.timeInput}
                  placeholder="09:30"
                  placeholderTextColor={colors.faint}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Section 2: Weekly Timetable */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.blue} />
          <Text style={styles.sectionTitle}>برنامه هفتگی درسی</Text>
        </View>

        {/* Day Tabs (Sat to Wed) */}
        <View style={styles.dayTabs}>
          {timetable.map((d, idx) => (
            <Pressable
              key={d.id}
              onPress={() => {
                setActiveDayIdx(idx);
                setActivePeriodIdx(0);
              }}
              style={[
                styles.dayTab,
                activeDayIdx === idx && styles.dayTabActive,
              ]}
            >
              <Text
                style={[
                  styles.dayTabText,
                  activeDayIdx === idx && styles.dayTabTextActive,
                ]}
              >
                {d.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Period Selector Tabs for Selected Day */}
        <View style={styles.periodTabsRow}>
          {[0, 1, 2, 3].map((pIdx) => (
            <Pressable
              key={pIdx}
              onPress={() => setActivePeriodIdx(pIdx)}
              style={[
                styles.periodTab,
                activePeriodIdx === pIdx && styles.periodTabActive,
              ]}
            >
              <Text
                style={[
                  styles.periodTabText,
                  activePeriodIdx === pIdx && styles.periodTabTextActive,
                ]}
              >
                زنگ {pIdx + 1}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Subject Palette for Quick Selection */}
        <Text style={styles.paletteHeader}>درس زنگ {activePeriodIdx + 1} ({activeDay.name}):</Text>
        <View style={styles.subjectChips}>
          {SUBJECT_LIST.map((subj) => (
            <Pressable
              key={subj.id}
              onPress={() => selectSubjectForPeriod(subj.id)}
              style={styles.chip}
            >
              <View
                style={[
                  styles.chipColorDot,
                  { backgroundColor: colors.blue },
                ]}
              />
              <Text style={styles.chipText}>{subj.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Continue Button */}
        <Pressable onPress={handleSaveAndContinue} style={styles.continueBtn}>
          <LinearGradient
            colors={[colors.accent, colors.accentDeep]}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText}>ثبت برنامه و ادامه</Text>
            <Ionicons name="arrow-back" size={18} color={colors.onAccent} />
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white05,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 16,
    color: colors.text,
  },
  mainTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 22,
    color: colors.text,
    textAlign: "right",
    marginTop: 10,
    marginBottom: 6,
  },
  subTitle: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.text,
  },
  periodsGrid: {
    gap: 8,
  },
  periodCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.panelPhone,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  periodLabel: {
    fontFamily: "Vazirmatn_600SemiBold",
    fontSize: 13,
    color: colors.text,
  },
  timeInputsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  timeInput: {
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.text,
    textAlign: "center",
    minWidth: 55,
  },
  timeSep: {
    fontFamily: "Vazirmatn_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  dayTabs: {
    flexDirection: "row-reverse",
    backgroundColor: colors.panelSolid,
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 11,
  },
  dayTabActive: {
    backgroundColor: colors.white12,
  },
  dayTabText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  dayTabTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: colors.text,
  },
  periodTabsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 14,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: colors.panelSolid,
    borderWidth: 1,
    borderColor: colors.line,
  },
  periodTabActive: {
    backgroundColor: colors.white10,
    borderColor: colors.accentLine,
  },
  periodTabText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 11,
    color: colors.muted,
  },
  periodTabTextActive: {
    fontFamily: "Vazirmatn_700Bold",
    color: colors.text,
  },
  paletteHeader: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 10,
  },
  subjectChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 26,
  },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.panelPhone,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: "Vazirmatn_500Medium",
    fontSize: 12,
    color: colors.text,
  },
  continueBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  continueGradient: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  continueText: {
    fontFamily: "Vazirmatn_700Bold",
    fontSize: 15,
    color: colors.onAccent,
  },
});
