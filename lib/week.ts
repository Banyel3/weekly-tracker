import { format, startOfISOWeek } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "Asia/Manila";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekRange = { start: string; end: string };

export function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ymdToDate(ymd: string): Date {
  return new Date(ymd + "T00:00:00.000Z");
}

export function todayYmd(now: Date = new Date()): string {
  return format(toZonedTime(now, TIMEZONE), "yyyy-MM-dd");
}

export function currentWeekStart(now: Date = new Date()): string {
  return format(startOfISOWeek(toZonedTime(now, TIMEZONE)), "yyyy-MM-dd");
}

export function weekRange(now: Date = new Date()): WeekRange {
  const start = currentWeekStart(now);
  return { start, end: dateToYmd(new Date(ymdToDate(start).getTime() + 6 * DAY_MS)) };
}

export function formatWeekRange(range: WeekRange): string {
  const start = formatInTimeZone(ymdToDate(range.start), "UTC", "EEE, MMM d");
  const end = formatInTimeZone(ymdToDate(range.end), "UTC", "EEE, MMM d, yyyy");
  return `${start} – ${end}`;
}
