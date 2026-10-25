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
