import type { ReviewDto } from "@/lib/review";
import { cn } from "@/lib/utils";
import { colorVar } from "../ColorSwatches";
import { percent } from "../stats/stats";
import { ProjectDot } from "./ProjectDot";
import { dayLine, headline } from "./review";
import { CARD, MUTED, TITLE } from "./styles";

type Props = { thisWeek: ReviewDto["thisWeek"]; today: string };

export function ThisWeekSection({ thisWeek, today }: Props) {
  const { main, overdue } = headline(thisWeek);
  return (
    <section aria-labelledby="review-this-week" className={CARD}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 id="review-this-week" className={TITLE}>
          This week so far
        </h3>
        <span className={MUTED}>{dayLine(today)}</span>
      </div>
      {thisWeek.planned === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">nothing planned yet</p>
      ) : (
        <>
          <p className="m-0 text-[20px] leading-7 font-medium tabular-nums">
            {main} ·{" "}
            <span className={cn(thisWeek.overdue > 0 && "text-[color:var(--alert)]")}>{overdue}</span>
          </p>
          <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-[899px]:grid-cols-2 max-[599px]:grid-cols-1">
            {thisWeek.byProject.map((p) => (
              <li key={p.projectId ?? "none"} className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <ProjectDot color={p.color} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                    {p.finished} / {p.planned}
                  </span>
                  <span className="sr-only">
                    {p.finished} of {p.planned} finished
                  </span>
                </div>
                <div aria-hidden="true" className="h-0.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent(p.finished, p.planned)}%`, background: colorVar(p.color) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
