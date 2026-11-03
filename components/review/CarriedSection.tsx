"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBoardContext } from "../BoardProvider";
import { statusLabel } from "../board/status";
import { useUndo } from "../useUndo";
import { ProjectDot } from "./ProjectDot";
import { carriedRows, decidedReducer, decidedText, type CarriedEntry, type CarriedRow, type Decided, type Decision } from "./review";
import { CARD, MUTED, TITLE } from "./styles";

const ACTION = "h-7 px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:px-3";

type Focus = { id: string; target: "undo" | "action" };
type Props = { carried: CarriedEntry[] };

export function CarriedSection({ carried }: Props) {
  const board = useBoardContext();
  const undo = useUndo();
  const [decided, dispatch] = useReducer(decidedReducer, {});
  const focus = useRef<Focus | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => dispatch({ type: "line", line: undo.line }), [undo.line]);

  useEffect(() => {
    const want = focus.current;
    if (!want) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-row="${want.id}"] [data-focus="${want.target}"]`);
    if (!el) return;
    focus.current = null;
    el.focus();
  });

  const live = useMemo(
    () => (board.status === "ready" ? new Map(board.tasks.map((t) => [t.id, t])) : null),
    [board.status, board.tasks],
  );
  const rows = carriedRows(carried, decided, live);
  const projectOf = (id: string | null) => board.projects.find((p) => p.id === id) ?? null;

  async function act(row: CarriedRow, index: number, kind: Decision) {
    const task = live?.get(row.entry.task.id);
    if (!task) return;
    focus.current = { id: task.id, target: "undo" };
    dispatch({ type: "decide", id: task.id, kind, entry: { ...row.entry, task }, index });
    if (kind === "deleted") board.removeTask(task);
    if (kind === "moved" && !(await board.moveTask(task, "THIS_WEEK"))) {
      focus.current = { id: task.id, target: "action" };
      dispatch({ type: "clear", id: task.id });
    }
  }

  function revert(id: string, d: Decided) {
    const armed = d.lineId !== null && undo.line?.id === d.lineId;
    if (d.kind !== "kept" && !armed) return;
    focus.current = { id, target: "action" };
    if (d.kind === "kept") dispatch({ type: "clear", id });
    else void undo.undo();
  }

  return (
    <section aria-labelledby="review-carried" className={CARD}>
      <h3 id="review-carried" className={cn(TITLE, "flex items-baseline gap-2.5")}>
        Carried over from last week
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{carried.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">nothing carried over</p>
      ) : (
        <ul ref={list} className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((row, index) => {
            const { task, rolloverCount } = row.entry;
            const project = projectOf(task.projectId);
            const d = row.decided;
            const actionable = !d && task.status === "BACKLOG" && live?.has(task.id);
            return (
              <li
                key={task.id}
                data-row={task.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2"
              >
                <div
                  className={cn(
                    "flex min-w-0 flex-1 basis-60 items-start gap-2.5 transition-opacity duration-150 ease-out motion-reduce:transition-none",
                    d && "opacity-70",
                  )}
                >
                  <span className="mt-[7px] flex">
                    <ProjectDot color={project?.color ?? "slate"} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="m-0 text-sm leading-5 font-medium [overflow-wrap:anywhere]">{task.title}</p>
                    <p className={cn(MUTED, "flex flex-wrap gap-x-2.5")}>
                      <span>{project?.name ?? "No project"}</span>
                      <span>now in {statusLabel(task.status)}</span>
                      {rolloverCount >= 2 && (
                        <span className="text-[color:var(--alert)] tabular-nums">rolled over {rolloverCount}×</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2.5 text-xs">
                  <span aria-live="polite" className="text-muted-foreground empty:hidden">
                    {d && decidedText(d.kind, task.title)}
                  </span>
                  {d && (
                    <Button
                      variant="link"
                      size="inline"
                      data-focus="undo"
                        aria-label={`undo: ${decidedText(d.kind, task.title)}`}
                        aria-disabled={d.kind !== "kept" && d.lineId === null}
                      onClick={() => revert(task.id, d)}
                      className="text-foreground"
                    >
                      undo
                    </Button>
                  )}
                  {actionable && (
                    <>
                      <Button
                        variant="secondary"
                        data-focus="action"
                        aria-label={`Move “${task.title}” to This week`}
                        onClick={() => void act(row, index, "moved")}
                        className={ACTION}
                      >
                        This week
                      </Button>
                      <Button
                        variant="outline"
                        aria-label={`Keep “${task.title}” in Backlog`}
                        onClick={() => void act(row, index, "kept")}
                        className={ACTION}
                      >
                        Keep
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Delete “${task.title}”`}
                        onClick={() => void act(row, index, "deleted")}
                        className={cn(ACTION, "text-muted-foreground hover:text-foreground")}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
