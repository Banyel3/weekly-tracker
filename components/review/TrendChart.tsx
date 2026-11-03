"use client";

import type { InsightsDto } from "@/lib/insights";
import { BarChart } from "../tremor/BarChart";
import { trendTick } from "./review";

type Week = InsightsDto["trend"][number];

const COLORS: Record<string, string> = { planned: "var(--chart-2)", finished: "var(--primary)" };

export function TrendChart({ trend, current }: { trend: Week[]; current: string }) {
  return (
    <BarChart<Week>
      data={trend}
      index="weekStart"
      category={["planned", "finished"]}
      colorOf={(_, category) => COLORS[category]}
      tickFormatter={(weekStart) => trendTick(weekStart, current)}
      barCategoryGap="22%"
      className="h-[120px]"
      aria-hidden="true"
    />
  );
}
