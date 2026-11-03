"use client";

import { useReducedMotion } from "motion/react";
import { WIP_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MovingBorderFrame } from "../aceternity/MovingBorder";
import { NumberTicker } from "../magic/NumberTicker";
import { HEADING, KPI, KPI_UNIT, MUTED, StatCard } from "./StatCard";
import { wipLine } from "./stats";

type Props = { inProgress: number; overdue: number; carried: number };

export function WipCard({ inProgress, overdue, carried }: Props) {
  const reduced = useReducedMotion();
  const over = inProgress > WIP_LIMIT;
  const card = (
    <StatCard
      labelledBy="stat-wip"
      className={cn("grid grid-cols-2 gap-3", over && reduced && "border-[color:var(--alert)]")}
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="stat-wip" className={HEADING}>
          In progress
        </h2>
        <p className={cn(KPI, over && "text-[color:var(--alert)]")}>
          <NumberTicker value={inProgress} /> <span className={KPI_UNIT}>/ {WIP_LIMIT} limit</span>
        </p>
        <p className={MUTED}>{wipLine(inProgress)}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className={HEADING}>Overdue</h3>
        <p className={KPI}>
          <NumberTicker value={overdue} />
        </p>
        <p className={MUTED}>{carried} carried over</p>
      </div>
    </StatCard>
  );
  return (
    <MovingBorderFrame
      active={over && !reduced}
      borderRadius="0.75rem"
      className="[&>section]:border-transparent"
      duration={4000}
    >
      {card}
    </MovingBorderFrame>
  );
}
