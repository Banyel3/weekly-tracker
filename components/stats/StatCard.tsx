import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const MUTED = "m-0 text-xs leading-4 text-muted-foreground";
export const KPI = "m-0 text-[22px] leading-7 font-medium tabular-nums";
export const KPI_UNIT = "text-[13px] font-normal text-muted-foreground";
export const HEADING = "m-0 text-xs leading-4 font-semibold text-muted-foreground";

type Props = { labelledBy?: string; className?: string; children?: ReactNode; busy?: boolean };

export function StatCard({ labelledBy, className, children, busy }: Props) {
  return (
    <section
      aria-labelledby={labelledBy}
      aria-busy={busy || undefined}
      className={cn("h-full min-h-[92px] rounded-xl border bg-card p-4 text-card-foreground", className)}
    >
      {children}
    </section>
  );
}
