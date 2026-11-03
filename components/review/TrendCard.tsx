"use client";

import dynamic from "next/dynamic";
import type { InsightsDto } from "@/lib/insights";
import { completionLine, droppedLine, trendLabel } from "./review";
import { CARD, MUTED, TITLE } from "./styles";

// The tooltip stack is heavy for a route that needs it once; it loads after the page, in a box of the same size.
const TrendInfo = dynamic(() => import("./TrendInfo").then((m) => m.TrendInfo), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="size-6 pointer-coarse:size-11" />,
});

const TrendChart = dynamic(() => import("./TrendChart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[120px]" />,
});

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function TrendCard({ trend, current }: { trend: InsightsDto["trend"]; current: string }) {
  const completion = completionLine(trend);
  const dropped = droppedLine(trend);
  const now = trend[trend.length - 1];
  return (
    <section aria-labelledby="review-trend" className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 id="review-trend" className={TITLE}>
            Planned vs finished
          </h3>
          <TrendInfo />
        </div>
        <span className="flex gap-3 text-xs leading-4 text-muted-foreground">
          <Key color="var(--chart-2)" label="planned" />
          <Key color="var(--primary)" label="finished" />
        </span>
      </div>
      <div role="img" aria-label={trendLabel(trend)}>
        <TrendChart trend={trend} current={current} />
      </div>
      <p className={`${MUTED} tabular-nums`}>
        {now && `this week ${now.finished} finished of ${now.planned} planned`}
        {completion && ` · ${completion}`}
        {dropped && ` · ${dropped}`}
      </p>
      <p className={MUTED}>planned = tasks put on a week · finished excludes same-week reopens · deleted shown as dropped</p>
    </section>
  );
}
