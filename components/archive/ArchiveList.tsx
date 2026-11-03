"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import type { TaskDto } from "@/lib/tasks";
import { TIMEZONE, ymdToDate } from "@/lib/week";
import { useBoardContext } from "../BoardProvider";
import { colorVar } from "../ColorSwatches";
import { PriorityFlag } from "../board/PriorityFlag";
import { SearchField } from "../board/SearchField";
import { UndoLine } from "../board/UndoLine";
import { sendDelete } from "../useBoard";
import { useDebounced } from "../useDebounced";
import { deletedLabel, useUndo } from "../useUndo";
import { hiddenArchiveRows } from "./archiveCache";
import { useArchive } from "./useArchive";

// Opens on click only, so the dialog and its form controls stay out of the first load.
const TaskDialog = dynamic(() => import("../board/TaskDialog").then((m) => m.TaskDialog), { ssr: false });

const SEARCH_ID = "archive-search";
const ymdLabel = (ymd: string) => formatInTimeZone(ymdToDate(ymd), "UTC", "MMM d");

function completedLabel(task: TaskDto): string {
  if (task.completedAt) return formatInTimeZone(new Date(task.completedAt), TIMEZONE, "MMM d");
  return task.weekOf ? ymdLabel(task.weekOf) : "";
}

export function ArchiveList() {
  const board = useBoardContext();
  const undo = useUndo();
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), SEARCH_DEBOUNCE_MS);
  const archive = useArchive(query);
  const hidden = useSyncExternalStore(hiddenArchiveRows.subscribe, hiddenArchiveRows.get, hiddenArchiveRows.get);
  const [open, setOpen] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = useMemo(() => open && { mode: "view" as const, task: open }, [open]);
  const projectOf = (id: string | null) => board.projects.find((p) => p.id === id) ?? null;

  const hide = hiddenArchiveRows.set;

  async function restore(task: TaskDto): Promise<string | null> {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    }).catch(() => null);
    if (!res?.ok) return "couldn't restore · try again";
    archive.drop(task.id);
    board.reload();
    return null;
  }

  function remove(task: TaskDto) {
    setError(null);
    hide(task.id, true);
    undo.register({
      label: deletedLabel(task.title),
      undo: () => hide(task.id, false),
      commit: async () => {
        const res = await sendDelete(`/api/tasks/${task.id}`);
        if (res?.ok || res?.status === 404) {
          archive.drop(task.id);
          board.reload();
          return;
        }
        hide(task.id, false);
        setError("couldn't delete");
      },
    });
  }

  const weeks = archive.weeks
    .map((w) => ({ ...w, tasks: w.tasks.filter((t) => !hidden.has(t.id)) }))
    .filter((w) => w.tasks.length > 0);

  return (
    <section aria-labelledby="archive-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="archive-heading" className="m-0 text-sm leading-5 font-medium">
          Archive
        </h2>
        <UndoLine returnFocusTo={SEARCH_ID} />
        <SearchField id={SEARCH_ID} value={q} onChange={setQ} className="ml-auto max-[599px]:w-full" />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-muted-foreground">
          {error}
        </p>
      )}
      {archive.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
        </div>
      )}
      {archive.status === "error" && (
        <p className="m-0 text-sm text-muted-foreground">
          couldn&apos;t load the archive ·{" "}
          <Button variant="link" size="inline" onClick={archive.retry} className="text-foreground">
            retry
          </Button>
        </p>
      )}
      {archive.status === "ready" && weeks.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">{query ? "no archived tasks match" : "nothing archived yet"}</p>
      )}
      {archive.status === "ready" &&
        weeks.map((week) => (
          <section key={week.start} aria-labelledby={`week-${week.start}`} className="flex flex-col gap-1.5">
            <h3 id={`week-${week.start}`} className="m-0 text-xs font-medium text-muted-foreground">
              Week of {ymdLabel(week.start)} – {ymdLabel(week.end)}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-1 rounded-xl border bg-card p-1.5">
              {week.tasks.map((task) => {
                const project = projectOf(task.projectId);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(task)}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                    >
                      <PriorityFlag priority={task.priority} omitWhenNone />
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {project && (
                        <Badge variant="outline" className="max-w-[40%] min-w-0 gap-1.5 px-2 py-0.5 font-normal text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: colorVar(project.color) }}
                          />
                          <span className="truncate">{project.name}</span>
                        </Badge>
                      )}
                      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {completedLabel(task)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      {archive.status === "ready" && archive.moreFailed && (
        <p role="alert" className="m-0 text-sm text-muted-foreground">
          couldn&apos;t load more ·{" "}
          <Button variant="link" size="inline" onClick={archive.older} className="text-foreground">
            retry
          </Button>
        </p>
      )}
      {archive.status === "ready" && archive.nextBefore && !archive.moreFailed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={archive.older}
          disabled={archive.loadingMore}
          className="self-start text-muted-foreground hover:text-foreground pointer-coarse:h-11"
        >
          {archive.loadingMore ? "Loading…" : "Older weeks"}
        </Button>
      )}
      <TaskDialog
        target={target}
        projects={board.projects}
        onRestore={restore}
        onDelete={remove}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}
