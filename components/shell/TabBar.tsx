"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BarChart3, CalendarDays, LayoutDashboard, Menu, type LucideIcon } from "lucide-react";
import type { Ref } from "react";
import { useBoardContext } from "@/components/BoardProvider";
import { cn } from "@/lib/utils";
import { nudgeCount } from "../review/review";

const TAB =
  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] leading-4 font-medium text-muted-foreground outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none";

type TabProps = { icon: LucideIcon; label: string; current?: boolean; badge?: number };

function TabContent({ icon: Icon, label, current, badge }: TabProps) {
  return (
    <>
      {current && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-primary" />}
      <span className="relative">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 left-3.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] leading-[16px] font-semibold text-primary-foreground tabular-nums">
            {badge}
            <span className="sr-only"> need attention</span>
          </span>
        )}
      </span>
      {label}
    </>
  );
}

type Props = { moreOpen: boolean; onMore: () => void; moreRef: Ref<HTMLButtonElement> };

export function TabBar({ moreOpen, onMore, moreRef }: Props) {
  const pathname = usePathname();
  const { tasks, counts, status } = useBoardContext();
  const tabs = [
    { href: "/", icon: LayoutDashboard, label: "Board", current: pathname === "/" },
    { href: "/#cal", icon: CalendarDays, label: "Calendar" },
    {
      href: "/review",
      icon: BarChart3,
      label: "Review",
      current: pathname === "/review",
      badge: status === "ready" ? nudgeCount(tasks) : counts.nudges,
    },
    { href: "/archive", icon: Archive, label: "Archive", current: pathname === "/archive" },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(56px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] min-[900px]:hidden"
    >
      {tabs.map(({ href, current, ...tab }) => (
        <Link
          key={href}
          href={href}
          aria-current={current ? "page" : undefined}
          className={cn(TAB, current ? "text-primary" : "hover:text-foreground")}
        >
          <TabContent current={current} {...tab} />
        </Link>
      ))}
      <button
        ref={moreRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onMore}
        className={cn(TAB, moreOpen ? "text-primary" : "hover:text-foreground")}
      >
        <TabContent icon={Menu} label="More" current={moreOpen} />
      </button>
    </nav>
  );
}
