import type { ReviewDto } from "@/lib/review";
import { ProjectDot } from "./ProjectDot";
import { lastWeekHeading, lastWeekLine } from "./review";
import { CARD, TITLE } from "./styles";

export function LastWeekSection({ lastWeek }: { lastWeek: ReviewDto["lastWeek"] }) {
  return (
    <section aria-labelledby="review-last-week" className={CARD}>
      <h3 id="review-last-week" className={TITLE}>
        {lastWeekHeading(lastWeek)}
      </h3>
      <p className="m-0 text-sm text-muted-foreground tabular-nums">{lastWeekLine(lastWeek)}</p>
      {lastWeek.planned > 0 && lastWeek.byProject.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {lastWeek.byProject.map((p) => (
            <li
              key={p.projectId ?? "none"}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
            >
              <ProjectDot color={p.color} />
              {p.name}
              <span className="text-muted-foreground tabular-nums">
                {p.finished}/{p.planned}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
