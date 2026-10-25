import type { SchoolPeriod } from "@/api/types";

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
