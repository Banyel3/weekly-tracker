"use client";

import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Command,
  Inbox,
  LayoutDashboard,
  Repeat,
  Send,
  Sparkles,
} from "lucide-react";
import { useBoardContext } from "@/components/BoardProvider";
import { formatWeekRange } from "@/lib/week";
import { nudgeCount } from "../review/review";
import { NavItem, SoonItem } from "./NavItem";
import { ProjectsList } from "./ProjectsList";
import { ThemePicker } from "./ThemePicker";

const GROUP_LABEL = "px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground";

const SOON = [
  { icon: Inbox, label: "Quick capture" },
  { icon: Repeat, label: "Recurring tasks" },
  { icon: Send, label: "Telegram digest" },
  { icon: Sparkles, label: "Someday / maybe" },
  { icon: Command, label: "Shortcuts" },
];

type Props = { showBars: "always" | "wide"; onNavigate?: () => void };

export function Sidebar({ showBars, onNavigate }: Props) {
  const pathname = usePathname();
  const { week, tasks, counts, status } = useBoardContext();
  const rolledBack = week ? tasks.filter((t) => t.status === "BACKLOG" && t.rolledBackAt === week.start).length : 0;

  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-5 text-sidebar-foreground">
      <header className="flex min-h-5 flex-col gap-1 pr-6">
        {week && <h1 className="m-0 text-sm leading-5 font-medium">{formatWeekRange(week)}</h1>}
        {rolledBack > 0 && (
          <p className="m-0 text-xs text-muted-foreground tabular-nums">{rolledBack} back from last week</p>
        )}
      </header>

      <nav aria-label="Main" className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-0.5">
          <span className={GROUP_LABEL}>OVERVIEW</span>
          <NavItem
            href="/"
            icon={LayoutDashboard}
            label="Board"
            count={counts.live}
            current={pathname === "/"}
            onNavigate={onNavigate}
          />
          <NavItem href="/#cal" icon={CalendarDays} label="Calendar" onNavigate={onNavigate} />
          <NavItem
            href="/review"
            icon={BarChart3}
            label="Weekly review"
            badge={status === "ready" ? nudgeCount(tasks) : counts.nudges}
            current={pathname === "/review"}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/archive"
            icon={Archive}
            label="Archive"
            count={counts.archived}
            current={pathname === "/archive"}
            onNavigate={onNavigate}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={GROUP_LABEL}>TOOLS · PHASE 3</span>
          {SOON.map((item) => (
            <SoonItem key={item.label} icon={item.icon} label={item.label} />
          ))}
        </div>
      </nav>

      <ProjectsList showBars={showBars} />

      <div className="mt-auto flex flex-col">
        <ThemePicker />
      </div>
    </div>
  );
}
