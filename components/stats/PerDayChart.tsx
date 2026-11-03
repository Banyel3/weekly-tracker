"use client";

import { BarChart } from "../tremor/BarChart";
import type { Bar } from "./stats";

export function PerDayChart({ bars }: { bars: Bar[] }) {
  const initials = new Map(bars.map((b) => [b.day, b.initial]));
  return (
    <BarChart<Bar>
      data={bars}
      index="day"
      category="finished"
      colorOf={(b) => (b.today ? "var(--primary)" : "var(--chart-2)")}
      tickFormatter={(day) => initials.get(day) ?? ""}
      className="h-[62px]"
      aria-hidden="true"
    />
  );
}
