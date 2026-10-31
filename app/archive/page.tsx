"use client";

import { useJson } from "@/components/useJson";
import type { ArchiveDto } from "@/lib/archive";
import { formatWeekRange } from "@/lib/week";

export default function ArchivePage() {
  const state = useJson<ArchiveDto>("/api/archive");

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="m-0 text-[15px] font-medium">Archive</h2>
      {state.status === "loading" && <p className="m-0 text-muted-foreground">loading…</p>}
      {state.status === "error" && <p className="m-0 text-muted-foreground">couldn&apos;t load the archive</p>}
      {state.status === "ready" && state.data.weeks.length === 0 && (
        <p className="m-0 text-muted-foreground">nothing here</p>
      )}
      {state.status === "ready" &&
        state.data.weeks.map((week) => (
          <section key={week.start} className="flex flex-col gap-1">
            <h3 className="m-0 text-xs font-semibold text-muted-foreground">{formatWeekRange(week)}</h3>
            <ul className="m-0 list-disc pl-5">
              {week.tasks.map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
