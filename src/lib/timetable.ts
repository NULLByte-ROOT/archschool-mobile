/**
 * The class's fixed weekly timetable, mirrored from the web client's
 * `frontend/src/data.ts`. Keep this file in sync with the web data: the ids
 * match `SUBJECT_LIST`, so a subject row can be linked to its assignments.
 */

import { SUBJECT_BY_ID, type Subject } from "./subjects";

export type Cell =
  | { kind: "class"; span: number; subjectId: string }
  | { kind: "free"; span: number };

export interface Day {
  id: string;
  name: string;
  short: string;
  cells: Cell[];
}

export const PERIOD_COUNT = 4;
export const PERIOD_LABELS = ["زنگ ۱", "زنگ ۲", "زنگ ۳", "زنگ ۴"];

export const TIMETABLE: Day[] = [
  {
    id: "sat",
    name: "شنبه",
    short: "ش",
    cells: [{ kind: "class", span: 4, subjectId: "web-design" }],
  },
  {
    id: "sun",
    name: "یکشنبه",
    short: "ی",
    cells: [
      { kind: "class", span: 1, subjectId: "persian" },
      { kind: "class", span: 1, subjectId: "human-env" },
      { kind: "class", span: 1, subjectId: "religion" },
      { kind: "class", span: 1, subjectId: "sports" },
    ],
  },
  {
    id: "mon",
    name: "دوشنبه",
    short: "د",
    cells: [
      { kind: "class", span: 1, subjectId: "arabic" },
      { kind: "class", span: 1, subjectId: "entrepreneurship" },
      { kind: "class", span: 1, subjectId: "history" },
      { kind: "class", span: 1, subjectId: "english" },
    ],
  },
  {
    id: "tue",
    name: "سه‌شنبه",
    short: "س",
    cells: [{ kind: "class", span: 4, subjectId: "content-creation" }],
  },
  {
    id: "wed",
    name: "چهارشنبه",
    short: "چ",
    cells: [
      { kind: "class", span: 1, subjectId: "production-mgmt" },
      { kind: "class", span: 1, subjectId: "media-literacy" },
      { kind: "class", span: 1, subjectId: "math" },
      { kind: "class", span: 1, subjectId: "chemistry" },
    ],
  },
];

export interface TimetableEntry {
  subject: Subject | null;
  label: string;
}

/** Expands a day into one row per bell (`span` aware), like the web client. */
export function flattenDay(day: Day): TimetableEntry[] {
  const rows: TimetableEntry[] = [];
  let period = 0;
  for (const cell of day.cells) {
    const label = cell.span === PERIOD_COUNT ? "تمام زنگ‌ها" : PERIOD_LABELS[period];
    if (cell.kind === "class") {
      rows.push({ subject: SUBJECT_BY_ID[cell.subjectId] ?? null, label });
    } else {
      rows.push({ subject: null, label });
    }
    period += cell.span;
  }
  return rows;
}

/** JS `getDay()` index → timetable day (Sat = 6 … Wed = 3). */
export function dayForDate(date: Date): Day | undefined {
  const index = date.getDay();
  const map: Record<number, string> = { 6: "sat", 0: "sun", 1: "mon", 2: "tue", 3: "wed" };
  const id = map[index];
  return id ? TIMETABLE.find((day) => day.id === id) : undefined;
}

/**
 * Index in `TIMETABLE` (Sat = 0 … Wed = 4, Thu/Fri = 5/6 = weekend).
 * Mirrors `todayIndex()` in the web client.
 */
export function todayIndex(base: Date = new Date()): number {
  return (base.getDay() + 1) % 7;
}

export function dayAtIndex(index: number): Day | undefined {
  return index >= 0 && index < TIMETABLE.length ? TIMETABLE[index] : undefined;
}

/** Sat→Sun→…→Wed→Sat; Thursday/Friday jump straight back to Saturday. */
export function nextSchoolDayIndex(index: number): number {
  if (index < 0) return 0;
  return index < TIMETABLE.length - 1 ? index + 1 : 0;
}

export interface ScheduleTarget {
  day: Day | undefined;
  /** True when the widget is showing a day other than today. */
  isTomorrow: boolean;
  /** Today's last bell has rung (or today is a weekend). */
  isAfterSchool: boolean;
  /** Today is Thursday/Friday. */
  isWeekend: boolean;
  /** The target is literally the calendar day after today. */
  isLiteralTomorrow: boolean;
}

/**
 * «کدام روز را نشان دهیم؟» — exactly the web's `scheduleTarget()`:
 * during the school day (before the last bell) show today, afterwards and on
 * holidays show the next school day. That is what stops the widget from
 * getting stuck on a finished day.
 */
export function scheduleTarget(
  now: number,
  schoolEndMinutes: number
): ScheduleTarget {
  const base = new Date(now);
  const minutes = base.getHours() * 60 + base.getMinutes();
  const today = todayIndex(base);
  const isWeekend = today >= TIMETABLE.length;
  const isAfterSchool = minutes >= schoolEndMinutes || isWeekend;
  const dayIndex = isAfterSchool ? nextSchoolDayIndex(today) : today;
  return {
    day: dayAtIndex(dayIndex),
    isTomorrow: isAfterSchool || dayIndex !== today,
    isAfterSchool,
    isWeekend,
    isLiteralTomorrow: dayIndex === (today + 1) % 7,
  };
}
