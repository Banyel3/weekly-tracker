"use client";

import { NumberTicker } from "../magic/NumberTicker";
import { ProgressCircle } from "../tremor/ProgressCircle";
import { HEADING, KPI, KPI_UNIT, MUTED, StatCard } from "./StatCard";
import { paceLine, percent } from "./stats";

type Props = { finished: number; planned: number; today: string };

export function ThisWeekCard({ finished, planned, today }: Props) {
  const pct = percent(finished, planned);
  return (
    <StatCard labelledBy="stat-week" className="flex items-center gap-4">
      <ProgressCircle value={pct} radius={28} strokeWidth={6} label={`${pct}% of this week finished`}>
        <span aria-hidden="true" className="text-xs font-semibold tabular-nums">
          {pct}%
        </span>
      </ProgressCircle>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id="stat-week" className={HEADING}>
          This week
        </h2>
        <p className={KPI}>
          <NumberTicker value={finished} /> <span className={KPI_UNIT}>of {planned} finished</span>
        </p>
        <p className={MUTED}>{paceLine(finished, planned, today)}</p>
      </div>
    </StatCard>
  );
}
