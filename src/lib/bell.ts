import type { SchoolPeriod } from "@/api/types";
import {
  DAY_MS,
  calendarDayDiff,
  faDate,
  fmtNum,
  parseDue,
} from "@/lib/format";
import { dayForDate } from "@/lib/timetable";

export interface Bell {
  number: number;
  label: string;
  /** دقیقه از نیمه‌شب */
  start: number;
  end: number;
}

const FALLBACK_PERIODS: SchoolPeriod[] = [
  { period_number: 1, start_time: "08:00", end_time: "09:30" },
  { period_number: 2, start_time: "09:30", end_time: "11:00" },
  { period_number: 3, start_time: "11:00", end_time: "12:30" },
  { period_number: 4, start_time: "12:30", end_time: "14:00" },
];

export function timeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = ((minutes % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function bellsFrom(periods: SchoolPeriod[] | null | undefined): Bell[] {
  const parsed = (periods ?? [])
    .map((period) => ({
      number: period.period_number,
      label: `زنگ ${period.period_number}`,
      start: timeToMinutes(period.start_time ?? ""),
      end: timeToMinutes(period.end_time ?? ""),
    }))
    .filter(
      (bell) =>
        Number.isFinite(bell.start) &&
        Number.isFinite(bell.end) &&
        bell.end > bell.start
    )
    .sort((a, b) => a.start - b.start || a.number - b.number);
  return parsed.length ? parsed : bellsFrom(FALLBACK_PERIODS);
}

/** شنبه تا چهارشنبه روز مدرسه است. */
export function isSchoolDay(date: Date): boolean {
  return [6, 0, 1, 2, 3].includes(date.getDay());
}

export function schoolStart(bells: Bell[]): number {
  return bells[0]?.start ?? 8 * 60;
}

export function schoolEnd(bells: Bell[]): number {
  return bells[bells.length - 1]?.end ?? 14 * 60;
}

export type CurrentBellState =
  | {
      state: "class";
      bell: Bell;
      bellIndex: number;
      remainingMs: number;
      progress: number;
      endsAtMs: number;
    }
  | {
      state: "break";
      previousBell: Bell;
      nextBell: Bell;
      nextBellIndex: number;
      remainingMs: number;
      progress: number;
      startedAtMs: number;
      endsAtMs: number;
    }
  | { state: "before"; firstBell: Bell; remainingMs: number; startsAtMs: number }
  | { state: "after"; lastBell: Bell }
  | { state: "holiday" };

/**
 * زنگ جاری / زنگ تفریح را از همان زمان‌هایی می‌سازد که ادمین ذخیره کرده است.
 * زنگ تفریح، فاصلهٔ بین پایان زنگ N و شروع زنگ N+1 است.
 */
export function getCurrentBellState(
  now: number = Date.now(),
  bells: Bell[] = []
): CurrentBellState {
  const list = bells.length ? bells : bellsFrom(FALLBACK_PERIODS);
  const date = new Date(now);
  if (!isSchoolDay(date)) return { state: "holiday" };

  const dayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const at = (minute: number) => dayStart + minute * 60_000;
  const remaining = (target: number) => Math.max(0, target - now);

  const first = list[0];
  if (now < at(first.start)) {
    return {
      state: "before",
      firstBell: first,
      remainingMs: remaining(at(first.start)),
      startsAtMs: at(first.start),
    };
  }

  for (let index = 0; index < list.length; index += 1) {
    const bell = list[index];
    const startMs = at(bell.start);
    const endMs = at(bell.end);
    if (now >= startMs && now < endMs) {
      return {
        state: "class",
        bell,
        bellIndex: index,
        remainingMs: remaining(endMs),
        progress: Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs))),
        endsAtMs: endMs,
      };
    }
  }

  for (let index = 0; index < list.length - 1; index += 1) {
    const previousBell = list[index];
    const nextBell = list[index + 1];
    const startedAtMs = at(previousBell.end);
    const endsAtMs = at(nextBell.start);
    if (endsAtMs > startedAtMs && now >= startedAtMs && now < endsAtMs) {
      return {
        state: "break",
        previousBell,
        nextBell,
        nextBellIndex: index + 1,
        remainingMs: remaining(endsAtMs),
        progress: Math.min(
          1,
          Math.max(0, (now - startedAtMs) / (endsAtMs - startedAtMs))
        ),
        startedAtMs,
        endsAtMs,
      };
    }
  }

  return { state: "after", lastBell: list[list.length - 1] };
}

export function leftMinutes(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

/* ------------------------------------------------------------------ */
/* Deadline countdown aligned with the admin's bell times             */
/* ------------------------------------------------------------------ */

export interface DayBellWindow {
  dayStartMs: number;
  startMs: number;
  endMs: number;
  isSchoolDay: boolean;
}

/** The school window of one calendar day, built from the saved bells. */
export function dayBellWindow(date: Date, bells: Bell[]): DayBellWindow {
  const dayStartMs = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const school = isSchoolDay(date);
  return {
    dayStartMs,
    startMs: school ? dayStartMs + schoolStart(bells) * 60_000 : dayStartMs,
    endMs: school ? dayStartMs + schoolEnd(bells) * 60_000 : dayStartMs,
    isSchoolDay: school,
  };
}

/**
 * First bell this subject has on `date`, or `null` when it is not taught that
 * day. Mirrors the web `subjectBellNumber` helper.
 */
export function subjectBellNumber(
  subjectId: string | null | undefined,
  date: Date
): number | null {
  if (!subjectId) return null;
  const day = dayForDate(date);
  if (!day) return null;
  let period = 0;
  for (const cell of day.cells) {
    if (cell.kind === "class" && cell.subjectId === subjectId) {
      return period + 1;
    }
    period += cell.span;
  }
  return null;
}

export interface DueCountdown {
  /** میلی‌ثانیهٔ تفاوت خام (مهلت - حال) */
  raw: number;
  /** میلی‌ثانیهٔ تفاوت تا هدف دقیق (شروع زنگ) */
  aligned: number;
  /** هدف دقیق: شروع زنگ مربوط به روز مهلت */
  alignedDueMs: number;
  /** اختلاف روز تقویمی (۰ = امروز) */
  dayDiff: number;
  overdue: boolean;
  urgent: boolean;
  /** «تا شروع زنگ ۲» یا «تا پایان مدرسه» */
  periodNote: string | null;
  isAligned: boolean;
  /** لیبل کامل فارسی برای نمایش */
  label: string;
  /** لیبل کوتاه (فقط «مانده») */
  short: string;
}

function humanLeft(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 60_000) {
    return `${fmtNum(Math.max(1, Math.round(ms / 1000)))} ثانیه`;
  }
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${fmtNum(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (ms < DAY_MS) {
    return rem
      ? `${fmtNum(hours)} ساعت و ${fmtNum(rem)} دقیقه`
      : `${fmtNum(hours)} ساعت`;
  }
  const days = Math.floor(hours / 24);
  const rh = hours % 24;
  return rh
    ? `${fmtNum(days)} روز و ${fmtNum(rh)} ساعت`
    : `${fmtNum(days)} روز`;
}

/**
 * Countdown to the START of the bell the subject has on the due date.
 *
 * This is the exact same logic the web client uses in `lib/bell.ts`, so the
 * number on a card and the number on the detail page cannot drift apart.
 *
 * - future school day → start of this subject's bell (fallback: first bell),
 * - today → that bell if it has not started yet, else the next upcoming bell,
 *   else the end of the school day,
 * - holiday → the raw due instant.
 */
export function dueCountdown(
  due: string | null | undefined,
  now: number,
  bells: Bell[],
  subjectId?: string | null
): DueCountdown | null {
  const dueDate = parseDue(due);
  if (!dueDate) return null;
  const dueMs = dueDate.getTime();
  if (Number.isNaN(dueMs)) return null;

  const list = bells.length ? bells : bellsFrom(FALLBACK_PERIODS);
  const dayDiff = calendarDayDiff(dueDate, new Date(now));
  const window = dayBellWindow(dueDate, list);
  const subjectBell = subjectBellNumber(subjectId, dueDate);

  let target: number;
  let isAligned = false;
  if (!window.isSchoolDay) {
    target = dueMs;
  } else if (dayDiff === 0) {
    const pendingSubjectBell = subjectBell
      ? list.find(
          (bell) =>
            bell.number === subjectBell &&
            window.dayStartMs + bell.start * 60_000 > now
        )
      : null;
    const upcoming =
      pendingSubjectBell ??
      list.find((bell) => window.dayStartMs + bell.start * 60_000 > now);
    if (upcoming) {
      target = window.dayStartMs + upcoming.start * 60_000;
      isAligned = true;
    } else {
      target = window.endMs;
      isAligned = true;
    }
  } else {
    const subjectPending = subjectBell
      ? list.find((bell) => bell.number === subjectBell)
      : null;
    target =
      window.dayStartMs + (subjectPending?.start ?? schoolStart(list)) * 60_000;
    isAligned = true;
  }

  const overdue = target <= now;
  const aligned = target - now;
  const urgent = !overdue && aligned > 0 && aligned < 48 * 3_600_000;

  let periodNote: string | null = null;
  if (isAligned && !overdue) {
    const targetBell = list.find(
      (bell) => window.dayStartMs + bell.start * 60_000 === target
    );
    periodNote = targetBell ? `تا شروع ${targetBell.label}` : "تا پایان مدرسه";
  }

  const when =
    dayDiff === 0 ? "امروز" : dayDiff === 1 ? "فردا" : faDate(dueDate, "dayMonth");

  let label: string;
  if (overdue) {
    if (dayDiff < 0) {
      const days = -dayDiff;
      label = days === 1 ? "1 روز گذشته" : `${fmtNum(days)} روز گذشته`;
    } else {
      label = "مهلت گذشته";
    }
  } else {
    label = `${when} · ${humanLeft(aligned)} مانده${
      periodNote ? ` · ${periodNote}` : ""
    }`;
  }

  return {
    raw: dueMs - now,
    aligned: Math.max(0, aligned),
    alignedDueMs: target,
    dayDiff,
    overdue,
    urgent,
    periodNote,
    isAligned,
    label,
    short: overdue ? "مهلت گذشته" : `${humanLeft(aligned)} مانده`,
  };
}

export type CountdownTone = "red" | "yellow" | "none";

/** Deadline colour based on the bell-aligned target, not the raw timestamp. */
export function countdownTone(c: DueCountdown | null): CountdownTone {
  if (!c) return "none";
  if (c.overdue || c.aligned < DAY_MS) return "red";
  if (c.aligned < DAY_MS * 2) return "yellow";
  return "none";
}
