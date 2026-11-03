"use client";

import dynamic from "next/dynamic";
import { HEADING, MUTED, StatCard } from "./StatCard";
import { perDayBars, perDayLabel } from "./stats";

const PerDayChart = dynamic(() => import("./PerDayChart").then((m) => m.PerDayChart), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[62px]" />,
});

type Props = { perDay: { day: string; finished: number }[]; today: string };

export function PerDayCard({ perDay, today }: Props) {
  const bars = perDayBars(perDay, today);
  return (
    <StatCard labelledBy="stat-per-day" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="stat-per-day" className={HEADING}>
          Finished per day
        </h2>
        <span className={MUTED}>last 7 days</span>
      </div>
      <div role="img" aria-label={perDayLabel(bars)}>
        <PerDayChart bars={bars} />
      </div>
    </StatCard>
  );
}
