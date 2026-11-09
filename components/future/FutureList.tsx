"use client";

import dynamic from "next/dynamic";
import { CalendarDays, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { TaskDto } from "@/lib/tasks";
import { useBoardContext } from "../BoardProvider";
import { colorVar } from "../ColorSwatches";
import { PriorityFlag } from "../board/PriorityFlag";
import { FUTURE, type Status } from "../board/status";
import { UndoLine } from "../board/UndoLine";
import { fmtYmd } from "../calendar/calendar";
import { isSaving } from "../savingTask";
import { submitDialog } from "../useBoard";
import { useTaskDialog } from "../useTaskDialog";
import { futureRows } from "./future";

// Opens on click only, so the dialog and its form controls stay out of the first load.
const TaskDialog = dynamic(() => import("../board/TaskDialog").then((m) => m.TaskDialog), { ssr: false });

const ADD_ID = "future-add";
const ACTION = "h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground pointer-coarse:h-11 pointer-coarse:px-3";
const MOVES: { to: Status; label: string }[] = [
  { to: "THIS_WEEK", label: "This week" },
  { to: "BACKLOG", label: "Backlog" },
];

function Retry({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p role="alert" className="m-0 text-sm text-muted-foreground">
      {text} ·{" "}
      <Button variant="link" size="inline" onClick={onRetry} className="text-foreground">
        retry
      </Button>
    </p>
  );
}

export function FutureList() {
  const board = useBoardContext();
  const { target, openTask, openCreate, close } = useTaskDialog();
  const rows = futureRows(board.tasks);
  const projectOf = (id: string | null) => board.projects.find((p) => p.id === id) ?? null;
  const thisYear = (board.today ?? "").slice(0, 4);

  async function move(task: TaskDto, to: Status) {
    // The row leaves at once, taking focus with it; hand focus to the undo line once the move is saved.
    if (await board.moveTask(task, to)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-undo-button]")?.focus());
    }
  }

  return (
    <section aria-labelledby="future-heading" className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-col">
          <h2 id="future-heading" className="m-0 text-sm leading-5 font-medium">
            Future tasks
          </h2>
          <p className="m-0 text-xs text-muted-foreground">dated ones move into This week when their week comes</p>
        </div>
        <UndoLine returnFocusTo={ADD_ID} />
        <Button
          id={ADD_ID}
          variant="outline"
          size="sm"
          onClick={() => openCreate(FUTURE.status)}
          className="ml-auto text-muted-foreground hover:text-foreground pointer-coarse:h-11"
        >
          <Icon icon={Plus} size="sm" />
          Add
          <span className="sr-only"> a task to Future</span>
        </Button>
      </div>
      {board.error === "save" && <Retry text="couldn't save" onRetry={board.retry} />}
      {board.status === "error" && <Retry text="couldn't load the board" onRetry={board.retry} />}
      {board.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <div className="h-10 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
        </div>
      )}
      {board.status === "ready" && rows.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">nothing parked for later</p>
      )}
      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 rounded-xl border bg-card p-1.5">
          {rows.map((task) => {
            const project = projectOf(task.projectId);
            const pending = isSaving(task);
            return (
              <li key={board.keyOf(task)} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  data-card-title={task.id}
                  disabled={pending}
                  onClick={() => openTask(task)}
                  className="flex min-h-10 min-w-0 flex-1 basis-60 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 pointer-coarse:min-h-11"
                >
                  <PriorityFlag priority={task.priority} omitWhenNone />
                  <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                  {project && (
                    <Badge variant="outline" className="max-w-[40%] min-w-0 gap-1.5 px-2 py-0.5 font-normal text-muted-foreground">
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(project.color) }} />
                      <span className="truncate">{project.name}</span>
                    </Badge>
                  )}
                  {task.dueDate && (
                    <Badge variant="outline" className="shrink-0 gap-1 px-2 py-0.5 font-normal text-muted-foreground tabular-nums">
                      <Icon icon={CalendarDays} size="sm" />
                      <span className="sr-only">due </span>
                      {fmtYmd(task.dueDate, task.dueDate.startsWith(thisYear) ? "MMM d" : "MMM d, yyyy")}
                    </Badge>
                  )}
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-1 pr-1">
                  {MOVES.map(({ to, label }) => (
                    <Button
                      key={to}
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Move “${task.title}” to ${label}`}
                      onClick={() => void move(task, to)}
                      className={ACTION}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TaskDialog
        target={target}
        projects={board.projects}
        onCreateProject={(name, color) => board.addProject({ name, color })}
        onSubmit={(body) => submitDialog(board, target, body)}
        onDelete={board.removeTask}
        onClose={close}
      />
    </section>
  );
}
