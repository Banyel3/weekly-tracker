"use client";

import { NumberTicker } from "../magic/NumberTicker";
import { ProgressCircle } from "../tremor/ProgressCircle";
import { KPI, KPI_UNIT, MUTED, StatCard, StatHeader } from "./StatCard";
import { pace, percent } from "./stats";

type Props = { finished: number; planned: number; today: string };

export function ThisWeekCard({ finished, planned, today }: Props) {
  const pct = percent(finished, planned);
  const { day, pace: projection } = pace(finished, planned, today);
  return (
    <StatCard labelledBy="stat-week">
      <StatHeader id="stat-week" title="This week" hint={day} />
      <div className="flex items-center gap-3">
        <ProgressCircle value={pct} radius={24} strokeWidth={4} label={`${pct}% of this week finished`}>
          <span aria-hidden="true" className="text-[11px] font-medium tabular-nums">
            {pct}%
          </span>
        </ProgressCircle>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={KPI}>
            <NumberTicker value={finished} /> <span className={KPI_UNIT}>of {planned} finished</span>
          </p>
          {projection && <p className={MUTED}>{projection}</p>}
        </div>
      </div>
    </StatCard>
  );
}
