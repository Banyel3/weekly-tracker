import { formatInTimeZone } from "date-fns-tz";
import type { Priority, Status } from "@prisma/client";
import { WIP_LIMIT } from "./constants";
import { shiftYmd, ymdToDate, type WeekRange } from "./week";

export type DigestTask = {
  id: string;
  title: string;
  /** YYYY-MM-DD in the app timezone, or null. */
  dueDate: string | null;
  status: Status;
  priority: Priority;
  /** ISO timestamp, used as the last tie-break. */
  createdAt: string;
  projectName: string | null;
};

export type DigestData = {
  today: string;
  week: WeekRange;
  /** Open tasks: not archived and not Done, any column. */
  tasks: DigestTask[];
  inProgress: number;
  openThisWeek: number;
  carried: number;
};

/** Telegram rejects messages longer than this. */
export const TELEGRAM_MAX_CHARS = 4096;
export const DIGEST_SECTION_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, NONE: 2 };

const weekday = (ymd: string) => formatInTimeZone(ymdToDate(ymd), "UTC", "EEE");
const daysBetween = (from: string, to: string) => Math.round((ymdToDate(to).getTime() - ymdToDate(from).getTime()) / DAY_MS);
const label = (t: DigestTask) => (t.projectName ? `${t.title} · ${t.projectName}` : t.title);

function byDueThenPriority(a: DigestTask, b: DigestTask): number {
  return (
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

function section(title: string, lines: string[], cap: number): string[] {
  if (lines.length === 0) return [];
  const shown = lines.slice(0, cap);
  if (lines.length > cap) shown.push(`… and ${lines.length - cap} more`);
  return [[title, ...shown].join("\n")];
}

/**
 * Pure and Prisma-free: the 09:00 Telegram digest. Sections follow the plan's exact format;
 * each lists at most 10 tasks, and the cap shrinks further only if the whole message would
 * still exceed Telegram's 4096-character limit (long titles).
 */
export function buildMorningDigest(data: DigestData): string {
  for (let cap = DIGEST_SECTION_LIMIT; cap > 1; cap--) {
    const text = render(data, cap);
    if (text.length <= TELEGRAM_MAX_CHARS) return text;
  }
  const text = render(data, 1);
  return text.length <= TELEGRAM_MAX_CHARS ? text : text.slice(0, TELEGRAM_MAX_CHARS - 1) + "…";
}

function render(data: DigestData, cap: number): string {
  const { today, week } = data;
  const tomorrow = shiftYmd(today, 1);
  const laterFrom = shiftYmd(today, 2);
  const dated = data.tasks.filter((t) => t.dueDate !== null).sort(byDueThenPriority);
  const due = (t: DigestTask) => t.dueDate as string;

  const overdue = dated.filter((t) => due(t) < today);
  const dueToday = dated.filter((t) => due(t) === today);
  const dueTomorrow = dated.filter((t) => due(t) === tomorrow);
  const later = dated.filter((t) => due(t) >= laterFrom && due(t) <= week.end);

  const dayIndex = formatInTimeZone(ymdToDate(today), "UTC", "i");
  const header = `Good morning · ${formatInTimeZone(ymdToDate(today), "UTC", "EEE MMM d")} · day ${dayIndex} of 7`;

  const laterSection = section(
    "Later this week",
    later.map((t) => `• ${weekday(due(t))}: ${label(t)}`),
    cap,
  );

  const footerParts = [`In progress ${data.inProgress}/${WIP_LIMIT}`, `${data.openThisWeek} open this week`];
  if (data.carried > 0) footerParts.push(`${data.carried} carried from last week`);
  const footer = footerParts.join(" · ");

  if (overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0) {
    if (later.length === 0 && data.openThisWeek === 0 && data.inProgress === 0) {
      return [header, "Nothing planned this week. Easy day."].join("\n\n");
    }
    return [header, `Nothing due today · ${data.openThisWeek} open this week`, ...laterSection, footer].join("\n\n");
  }

  return [
    header,
    ...section(
      "Overdue",
      overdue.map((t) => `• ${label(t)} — due ${weekday(due(t))}, ${daysBetween(due(t), today)}d late`),
      cap,
    ),
    ...section("Due today", dueToday.map((t) => `• ${label(t)}`), cap),
    ...section("Due tomorrow", dueTomorrow.map((t) => `• ${label(t)}`), cap),
    ...laterSection,
    footer,
  ].join("\n\n");
}
