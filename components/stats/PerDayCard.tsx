"use client";

import dynamic from "next/dynamic";
import { StatCard, StatHeader } from "./StatCard";
import { perDayBars, perDayLabel } from "./stats";

const PerDayChart = dynamic(() => import("./PerDayChart").then((m) => m.PerDayChart), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[62px]" />,
});

type Props = { perDay: { day: string; finished: number }[]; today: string };

export function PerDayCard({ perDay, today }: Props) {
  const bars = perDayBars(perDay, today);
  return (
    <StatCard labelledBy="stat-per-day">
      <StatHeader id="stat-per-day" title="Finished per day" hint="last 7 days" />
      <div role="img" aria-label={perDayLabel(bars)}>
        <PerDayChart bars={bars} />
      </div>
    </StatCard>
  );
}
