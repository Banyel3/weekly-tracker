"use client";

import type { InsightsDto } from "@/lib/insights";
import { BarChart } from "../tremor/BarChart";
import { trendTick } from "./review";

type Week = InsightsDto["trend"][number];

const COLORS: Record<string, string> = { planned: "var(--chart-2)", finished: "var(--primary)" };

/** Earlier weeks at 55% so the current week's pair stands out by more than its tick label. */
export const trendColor = (weekStart: string, category: string, current: string) =>
  weekStart === current ? COLORS[category] : `color-mix(in oklch,${COLORS[category]} 55%,#0000)`;

export function TrendChart({ trend, current }: { trend: Week[]; current: string }) {
  return (
    <BarChart<Week>
      data={trend}
      index="weekStart"
      category={["planned", "finished"]}
      colorOf={(week, category) => trendColor(week.weekStart, category, current)}
      tickFormatter={(weekStart) => trendTick(weekStart, current)}
      barCategoryGap="22%"
      className="h-[120px]"
      aria-hidden="true"
    />
  );
}
