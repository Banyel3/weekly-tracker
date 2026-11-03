"use client";

import { NumberTicker } from "../magic/NumberTicker";
import { ProgressCircle } from "../tremor/ProgressCircle";
import { KPI, KPI_UNIT, StatCard, StatHeader } from "./StatCard";
import { paceLine, percent } from "./stats";

type Props = { finished: number; planned: number; today: string };

export function ThisWeekCard({ finished, planned, today }: Props) {
  const pct = percent(finished, planned);
  return (
    <StatCard labelledBy="stat-week">
      <StatHeader id="stat-week" title="This week" hint={paceLine(finished, planned, today)} />
      <div className="flex items-center gap-3">
        <ProgressCircle value={pct} radius={24} strokeWidth={4} label={`${pct}% of this week finished`}>
          <span aria-hidden="true" className="text-[11px] font-medium tabular-nums">
            {pct}%
          </span>
        </ProgressCircle>
        <p className={KPI}>
          <NumberTicker value={finished} /> <span className={KPI_UNIT}>of {planned} finished</span>
        </p>
      </div>
    </StatCard>
  );
}
