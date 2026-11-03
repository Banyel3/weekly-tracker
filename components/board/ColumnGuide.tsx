"use client";

import { useRef, type KeyboardEvent } from "react";
import { WIP_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { guideLabels } from "./carousel";
import { COLUMNS } from "./dnd";
import { statusVar } from "./Column";

export type GuideColumn = { shown: number; total: number };

type Props = {
  index: number;
  columns: GuideColumn[];
  panelId: (index: number) => string;
  onGo: (index: number) => void;
};

export function ColumnGuide({ index, columns, panelId, onGo }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { left, current, right } = guideLabels(index);
  const { status } = COLUMNS[index];
  const { shown, total } = columns[index];
  const overLimit = status === "IN_PROGRESS" && total > WIP_LIMIT;

  function go(next: number) {
    const i = Math.min(COLUMNS.length - 1, Math.max(0, next));
    onGo(i);
    tabs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home") go(0);
    else if (e.key === "End") go(COLUMNS.length - 1);
    else if (step) go(index + step);
    else return;
    e.preventDefault();
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div aria-hidden="true" className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs leading-5">
        <span className="truncate text-muted-foreground">{left && `‹ ${left}`}</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <span className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
          {current}
          <span className={cn("font-normal tabular-nums", overLimit ? "text-[color:var(--alert)]" : "text-muted-foreground")}>
            · {overLimit ? `${total} / ${WIP_LIMIT}` : shown}
          </span>
        </span>
        <span className="truncate text-right text-muted-foreground">{right && `${right} ›`}</span>
      </div>
      <div role="tablist" aria-label="Board columns" onKeyDown={onKeyDown} className="flex items-center">
        {COLUMNS.map(({ status: s, label }, i) => (
          <button
            key={s}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls={panelId(i)}
            aria-label={`Go to ${label}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => go(i)}
            className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors duration-150 ease-out motion-reduce:transition-none",
                i === index ? "bg-primary" : "bg-border",
              )}
            />
          </button>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        Showing {current}, {shown} {shown === 1 ? "task" : "tasks"}
      </p>
    </div>
  );
}
