"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const ROW =
  "flex min-h-[34px] w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left text-sm transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none pointer-coarse:min-h-11";

type Props = {
  href: string;
  icon: LucideIcon;
  label: string;
  current?: boolean;
  count?: number;
  badge?: number;
  onNavigate?: () => void;
};

export function NavItem({ href, icon: Icon, label, current = false, count, badge, onNavigate }: Props) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        ROW,
        current ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
          <span className="sr-only"> tasks</span>
        </span>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className="rounded-full bg-primary px-[7px] text-[11px] leading-[18px] font-semibold text-primary-foreground tabular-nums"
        >
          {badge}
          <span className="sr-only"> need attention</span>
        </span>
      )}
    </Link>
  );
}

type SoonProps = { icon: LucideIcon; label: string };

export function SoonItem({ icon: Icon, label }: SoonProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={cn(ROW, "cursor-default border-0 bg-transparent text-muted-foreground opacity-60")}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="rounded-lg border border-sidebar-border px-1.5 text-[10px] leading-4">soon</span>
    </button>
  );
}
