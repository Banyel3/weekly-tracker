import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const MUTED = "m-0 text-xs leading-4 text-muted-foreground";
export const KPI = "m-0 text-2xl leading-8 font-semibold tabular-nums";
export const KPI_UNIT = "text-xs font-normal text-muted-foreground";
export const HEADING = "m-0 text-xs leading-4 font-medium text-muted-foreground";

type Props = { labelledBy?: string; className?: string; children?: ReactNode; busy?: boolean };

export function StatCard({ labelledBy, className, children, busy }: Props) {
  return (
    <section
      aria-labelledby={labelledBy}
      aria-busy={busy || undefined}
      className={cn("flex h-full min-h-[104px] flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground", className)}
    >
      {children}
    </section>
  );
}

type HeaderProps = { id: string; title: string; hint?: ReactNode };

/** The same title-left, hint-right row on every stat card. */
export function StatHeader({ id, title, hint }: HeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id={id} className={HEADING}>
        {title}
      </h2>
      {hint && <span className={cn(MUTED, "truncate")}>{hint}</span>}
    </div>
  );
}
