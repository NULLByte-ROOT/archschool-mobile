import { colors } from "@/theme/tokens";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const PERSIAN_DIGITS = /[۰-۹٠-٩]/g;
const DIGIT_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/** Every dynamic number in this app is Latin. This is the last line of defence. */
export function latinDigits(value: string): string {
  return value.replace(PERSIAN_DIGITS, (digit) => DIGIT_MAP[digit] ?? digit);
}

export function fmtNum(value: number): string {
  try {
    return latinDigits(new Intl.NumberFormat("en-US").format(value));
  } catch {
    return String(value);
  }
}

export function fmtPercent(value: number, fractionDigits = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${latinDigits(safe.toFixed(fractionDigits))}%`;
}

export type DateStyle = "full" | "short" | "time" | "dayMonth" | "weekdayTime";

const dateCache = new Map<string, string>();

function buildDate(date: Date, style: DateStyle): string {
  const options: Intl.DateTimeFormatOptions =
    style === "full"
      ? { weekday: "long", day: "numeric", month: "long" }
      : style === "dayMonth"
        ? { day: "numeric", month: "long" }
        : style === "time"
          ? { hour: "2-digit", minute: "2-digit" }
          : style === "weekdayTime"
            ? { weekday: "long", hour: "2-digit", minute: "2-digit" }
            : { day: "numeric", month: "short" };

  try {
    return latinDigits(
      new Intl.DateTimeFormat("fa-IR-u-nu-latn", options).format(date)
    );
  } catch {
    // Hermes without full ICU: still legible, still Latin digits.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (style === "time") {
      return `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
      ).padStart(2, "0")}`;
    }
    return `${y}/${m}/${d}`;
  }
}

export function faDate(value: string | number | Date, style: DateStyle = "short"): string {
  // API timestamps are naive UTC (`2026-10-24T12:00:00`); `new Date(string)`
  // would read that as local time and shift every chat/assignment clock by the
  // device offset. Date-only values are activity buckets and stay local.
  const date =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? new Date(`${value}T00:00:00`)
          : (parseDue(value) ?? new Date(Number.NaN))
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const key = `${date.getTime()}|${style}`;
  const hit = dateCache.get(key);
  if (hit !== undefined) return hit;
  const formatted = buildDate(date, style);
  if (dateCache.size > 1200) dateCache.clear();
  dateCache.set(key, formatted);
  return formatted;
}

/** Deadlines are stored as naive UTC (same convention as the web client). */
export function parseDue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDue(value: string | null | undefined): string {
  const date = parseDue(value);
  return date ? faDate(date, "full") : "بدون مهلت";
}

export function calendarDayDiff(due: Date, base = new Date()): number {
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const baseDay = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((dueDay - baseDay) / DAY_MS);
}

export function relativeDue(
  value: string | null | undefined,
  now = Date.now()
): string {
  const due = parseDue(value);
  if (!due) return "بدون مهلت";

  const diff = due.getTime() - now;
  const dayDiff = calendarDayDiff(due, new Date(now));

  if (dayDiff < 0) {
    const days = -dayDiff;
    return days === 1 ? "1 روز گذشته" : `${days} روز گذشته`;
  }
  if (dayDiff === 0) {
    if (diff <= 0) return "مهلت گذشته";
    if (diff < HOUR_MS) {
      const minutes = Math.max(1, Math.round(diff / 60_000));
      return `امروز · ${minutes} دقیقه مانده`;
    }
    const hours = Math.max(1, Math.round(diff / HOUR_MS));
    return `امروز · ${hours} ساعت مانده`;
  }
  return dayDiff === 1 ? "1 روز مانده" : `${dayDiff} روز مانده`;
}

export type DueTone = "red" | "amber" | "none";

export function dueTone(value: string | null | undefined, now = Date.now()): DueTone {
  const due = parseDue(value);
  if (!due) return "none";
  return due.getTime() - now < DAY_MS ? "red" : "amber";
}

export function dueColor(tone: DueTone): string {
  if (tone === "red") return colors.red;
  // Due-soon keeps the semantic amber (web `--color-warning`); the general
  // accent is white now, so `colors.amber` can no longer mean "urgent".
  if (tone === "amber") return colors.warning;
  return colors.muted;
}

/**
 * «آنلاین» or «آخرین بازدید: امروز، ساعت 15:30».
 *
 * The backend stamps `users.last_seen` on every authenticated request and on
 * every socket open, so a two-minute window is a truthful "online".
 */
export function lastSeenLabel(
  value: string | null | undefined,
  now = Date.now()
): string {
  const date = parseDue(value);
  if (!date) return "آخرین بازدید: نامشخص";
  const diff = now - date.getTime();
  if (diff < 2 * 60_000) return "آنلاین";
  if (diff < HOUR_MS) {
    const minutes = Math.max(1, Math.round(diff / 60_000));
    return `آخرین بازدید: ${minutes} دقیقه پیش`;
  }
  const dayDiff = calendarDayDiff(date, new Date(now));
  if (dayDiff === 0) return `آخرین بازدید: امروز، ساعت ${faDate(date, "time")}`;
  if (dayDiff === -1) return `آخرین بازدید: دیروز، ساعت ${faDate(date, "time")}`;
  if (diff < 7 * DAY_MS) {
    return `آخرین بازدید: ${Math.floor(diff / DAY_MS)} روز پیش`;
  }
  return `آخرین بازدید: ${faDate(date, "full")}، ساعت ${faDate(date, "time")}`;
}

export function isOverdue(value: string | null | undefined, now = Date.now()): boolean {
  const due = parseDue(value);
  return Boolean(due && due.getTime() < now);
}

/** Hour of the school clock (Iran, UTC+03:30), independent of device timezone. */
export function schoolHour(now = Date.now()): number {
  return new Date(now + 3.5 * HOUR_MS).getUTCHours();
}

export function greeting(now = Date.now()): string {
  const hour = schoolHour(now);
  if (hour < 5) return "شب بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "ظهر بخیر";
  if (hour < 21) return "عصر بخیر";
  return "شب بخیر";
}

export function todayLabel(now = Date.now()): string {
  return faDate(now, "full");
}

export function initials(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  return clean ? clean.slice(0, 1).toUpperCase() : "؟";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  const rendered = index === 0 ? value.toFixed(0) : value.toFixed(value >= 10 ? 0 : 1);
  return `${latinDigits(rendered)} ${units[index]}`;
}

export { DAY_MS, HOUR_MS };
