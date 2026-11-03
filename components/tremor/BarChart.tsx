// Tremor BarChart [v1.0.0]

"use client";

import React from "react";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type ShapeProps = { x?: number; y?: number; width?: number; height?: number; payload?: Record<string, unknown> };

interface BarChartProps<T extends Record<string, unknown>> extends React.HTMLAttributes<HTMLDivElement> {
  data: T[];
  index: string;
  category: string;
  /** CSS color per datum, e.g. a theme variable. */
  colorOf: (datum: T) => string;
  tickFormatter?: (value: string) => string;
  baselineColor?: string;
  barCategoryGap?: string | number;
}

function renderShape<T extends Record<string, unknown>>(
  props: ShapeProps,
  category: string,
  colorOf: (datum: T) => string,
  baselineColor: string,
) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const datum = (payload ?? {}) as T;
  if (!Number(datum[category])) {
    return <rect x={x} y={y + height - 2} width={width} height={2} rx={1} style={{ fill: baselineColor }} />;
  }
  return <rect x={x} y={y} width={width} height={height} rx={3} style={{ fill: colorOf(datum) }} />;
}

function BarChart<T extends Record<string, unknown>>({
  data,
  index,
  category,
  colorOf,
  tickFormatter,
  baselineColor = "var(--border)",
  barCategoryGap = "18%",
  className,
  ...other
}: BarChartProps<T>) {
  return (
    <div className={cn("h-16 w-full", className)} tremor-id="tremor-raw" {...other}>
      <ResponsiveContainer>
        <RechartsBarChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={barCategoryGap}
          accessibilityLayer={false}
        >
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            interval={0}
            height={18}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
          />
          <YAxis hide domain={[0, "dataMax"]} allowDecimals={false} />
          <Bar
            dataKey={category}
            isAnimationActive={false}
            minPointSize={2}
            shape={(props: ShapeProps) => renderShape(props, category, colorOf, baselineColor)}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { BarChart, type BarChartProps };
