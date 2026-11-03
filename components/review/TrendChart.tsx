"use client";

import type { InsightsDto } from "@/lib/insights";
import { BarChart } from "../tremor/BarChart";
import { trendColor, trendTick } from "./review";

type Week = InsightsDto["trend"][number];

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
