"use client";

import { BarChart } from "../tremor/BarChart";
import { HEADING, MUTED, StatCard } from "./StatCard";
import { perDayBars, perDayLabel, type Bar } from "./stats";

type Props = { perDay: { day: string; finished: number }[]; today: string };

export function PerDayCard({ perDay, today }: Props) {
  const bars = perDayBars(perDay, today);
  const initials = new Map(bars.map((b) => [b.day, b.initial]));
  return (
    <StatCard labelledBy="stat-per-day" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="stat-per-day" className={HEADING}>
          Finished per day
        </h2>
        <span className={MUTED}>last 7 days</span>
      </div>
      <div role="img" aria-label={perDayLabel(bars)}>
        <BarChart<Bar>
          data={bars}
          index="day"
          category="finished"
          colorOf={(b) => (b.today ? "var(--primary)" : "var(--chart-2)")}
          tickFormatter={(day) => initials.get(day) ?? ""}
          className="h-[62px]"
          aria-hidden="true"
        />
      </div>
    </StatCard>
  );
}
