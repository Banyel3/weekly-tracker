import { formatInTimeZone } from "date-fns-tz";
import type { ReviewDto } from "./review";
import { ymdToDate } from "./week";

/** Pure and Prisma-free so the review page can render the same text it previews. */
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
    .filter((c) => c.task.status === "BACKLOG" && c.rolloverCount >= 2)
    .map((c) => c.task.title);
  if (stuck.length > 0) lines.push(`Carried over twice or more: ${stuck.join(", ")}`);
  return lines.join("\n");
}
