"use client";

import { AnimatedGroup } from "../motion/AnimatedGroup";
import { useReviewContext } from "../useReview";
import { MUTED, StatCard } from "./StatCard";
import { PerDayCard } from "./PerDayCard";
import { ThisWeekCard } from "./ThisWeekCard";
import { WipCard } from "./WipCard";

const GRID =
  "grid grid-cols-3 gap-3 max-[1099px]:grid-cols-2 max-[1099px]:[&>*:last-child]:col-span-2 max-[599px]:grid-cols-1 max-[599px]:[&>*:last-child]:col-span-1";

export function StatsRow() {
  const review = useReviewContext();

  if (review.status !== "ready") {
    return (
      <div role="group" className={GRID} aria-label="This week's numbers">
        {[0, 1, 2].map((i) => (
          <StatCard key={i} busy={review.status === "loading"}>
            {i === 0 && review.status === "error" && <p className={MUTED}>couldn&apos;t load the numbers</p>}
          </StatCard>
        ))}
      </div>
    );
  }

  const { thisWeek, today, perDay, carried } = review.data;
  const stillCarried = carried.filter((c) => c.task.status === "BACKLOG").length;
  return (
    <AnimatedGroup className={GRID}>
      <ThisWeekCard finished={thisWeek.finished} planned={thisWeek.planned} today={today} />
      <PerDayCard perDay={perDay} today={today} />
      <WipCard inProgress={thisWeek.inProgress} overdue={thisWeek.overdue} carried={stillCarried} />
    </AnimatedGroup>
  );
}
