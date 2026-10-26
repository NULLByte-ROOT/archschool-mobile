/**
 * Due-date helpers mirrored from the web client's `lib/assignments.ts`.
 *
 * The class week starts on Saturday, so `dateAt(0, 0)` is this week's Saturday
 * and every due date lands at 23:59 on the chosen day — exactly the convention
 * the web uses, which keeps the two clients in sync on the same deadline.
 */

import { TIMETABLE } from "./timetable";

export const DAY_MS = 86_400_000;

export const WEEK_DAYS = TIMETABLE.map((day, index) => ({
  index,
  id: day.id,
  name: day.name,
  short: day.short,
}));

const DAY_INDEX: Record<string, number> = { sat: 0, sun: 1, mon: 2, tue: 3, wed: 4 };

/** The timetable day a subject belongs to (first match wins). */
export const SUBJECT_DAY: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const day of TIMETABLE) {
    for (const cell of day.cells) {
      if (cell.kind !== "class") continue;
      if (!(cell.subjectId in map)) map[cell.subjectId] = DAY_INDEX[day.id];
    }
  }
  return map;
})();

/** Saturday-based start of the week. */
export function startOfWeek(base: Date = new Date()): Date {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const offset = (date.getDay() + 1) % 7; // Saturday = 0 … Friday = 6
  date.setDate(date.getDate() - offset);
  return date;
}

export function todayIndex(base: Date = new Date()): number {
  return (base.getDay() + 1) % 7;
}

/** Saturday 23:59 of `weekOffset` weeks from now, on `dayIndex`. */
export function dateAt(weekOffset: number, dayIndex: number, base: Date = new Date()): Date {
  const date = new Date(startOfWeek(base));
  date.setDate(date.getDate() + weekOffset * 7 + dayIndex);
  date.setHours(23, 59, 0, 0);
  return date;
}

export function weekOffsetOf(date: Date, base: Date = new Date()): number {
  return Math.round(
    (startOfWeek(date).getTime() - startOfWeek(base).getTime()) / (7 * DAY_MS)
  );
}

/** The next time the subject is taught: this week if still ahead, else next. */
export function defaultDueForSubject(
  subjectId: string,
  base: Date = new Date()
): Date | null {
  const dayIndex = SUBJECT_DAY[subjectId];
  if (dayIndex === undefined) return null;
  const upcoming = dayIndex > todayIndex(base) ? 0 : 1;
  return dateAt(upcoming, dayIndex, base);
}
