import { Status } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { setState } from "./appState";
import { sendTelegram, telegramConfigured } from "./reminders";
import { getReview, type ReviewDto } from "./review";
import { todayYmd, ymdToDate } from "./week";

export const SUMMARY_SENT_KEY = "lastSentOn:summary";

export function buildWeeklySummaryText(review: ReviewDto): string {
  const { thisWeek } = review;
  const weekOf = formatInTimeZone(ymdToDate(review.week.start), "UTC", "MMM d");
  const lines = [
    `Week of ${weekOf}: finished ${thisWeek.finished} of ${thisWeek.planned} · ${thisWeek.inProgress} in progress · ${thisWeek.overdue} overdue`,
  ];
  if (thisWeek.byProject.length > 0) {
    lines.push(thisWeek.byProject.map((p) => `${p.name} ${p.finished}/${p.planned}`).join(" · "));
  }
  const stuck = review.carried
    .filter((c) => c.task.status === Status.BACKLOG && c.rolloverCount >= 2)
    .map((c) => c.task.title);
  if (stuck.length > 0) lines.push(`Carried over twice or more: ${stuck.join(", ")}`);
  return lines.join("\n");
}

export async function sendWeeklySummary(now: Date = new Date()): Promise<void> {
  if (!telegramConfigured()) return;
  const text = buildWeeklySummaryText(await getReview(now));
  if (await sendTelegram(text, "summary")) await setState(SUMMARY_SENT_KEY, todayYmd(now));
}
