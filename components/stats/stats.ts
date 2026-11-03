import { WIP_LIMIT } from "../../lib/constants";
import { ymdToDate } from "../../lib/week";

export type Bar = { day: string; initial: string; label: string; finished: number; today: boolean };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(ymd: string): number {
  return ((ymdToDate(ymd).getUTCDay() + 6) % 7) + 1;
}

export function percent(finished: number, planned: number): number {
  return planned > 0 ? Math.round((finished / planned) * 100) : 0;
}

export function paceLine(finished: number, planned: number, today: string): string {
  if (planned === 0) return "nothing planned yet";
  const d = isoWeekday(today);
  if (d === 1) return "day 1 of 7";
  return `day ${d} of 7 · on pace for ${Math.round((finished / d) * 7)}`;
}

export function perDayBars(perDay: { day: string; finished: number }[], today: string): Bar[] {
  return perDay.map(({ day, finished }) => {
    const label = WEEKDAYS[ymdToDate(day).getUTCDay()];
    return { day, initial: label[0], label, finished, today: day === today };
  });
}

export function perDayLabel(bars: Bar[]): string {
  return `Finished per day: ${bars.map((b) => `${b.label} ${b.finished}`).join(", ")}`;
}

export function wipLine(inProgress: number, limit: number = WIP_LIMIT): string {
  return inProgress > limit ? "finish one before starting" : `room for ${limit - inProgress} more`;
}
