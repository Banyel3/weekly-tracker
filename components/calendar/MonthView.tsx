// adapted from https://github.com/origin-space/event-calendar
"use client";

import type { ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { fmtYmd, monthGrid, type Month } from "./calendar";
import { StaticChip } from "./EventChip";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type Props = {
  month: Month;
  today: string;
  tasksOn: (ymd: string) => TaskDto[];
  projectOf: (id: string | null) => ProjectDto | null;
  onOpen: (task: TaskDto) => void;
};

export function MonthView({ month, today, tasksOn, projectOf, onOpen }: Props) {
  const days = monthGrid(month);
  const inMonth = (ymd: string) => Number(ymd.slice(5, 7)) === month.month;
  return (
    <div className="max-[899px]:min-w-[49rem]">
      <div aria-hidden="true" className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold tracking-[0.02em] text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((ymd) => {
          const isToday = ymd === today;
          const tasks = tasksOn(ymd);
          return (
            <div
              key={ymd}
              role="group"
              aria-label={`${fmtYmd(ymd, "EEEE, MMM d")}${isToday ? ", today" : ""}: ${tasks.length} due`}
              className={cn(
                "flex min-h-[88px] min-w-0 flex-col gap-1 border-r border-b px-1.5 pt-1.5 pb-2 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                isToday && "bg-muted",
                !inMonth(ymd) && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "self-start text-xs font-medium tabular-nums",
                  isToday && "rounded-full bg-primary px-1.5 text-primary-foreground",
                )}
              >
                {fmtYmd(ymd, "d")}
              </span>
              {tasks.map((task) => (
                <StaticChip
                  key={task.id}
                  task={task}
                  project={projectOf(task.projectId)}
                  today={today}
                  onOpen={onOpen}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
