"use client";

import { useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { WIP_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { guideLabels } from "./carousel";
import { COLUMNS } from "./dnd";
import { statusVar } from "./Column";

export type GuideColumn = { shown: number; total: number };

type Props = {
  ref?: Ref<HTMLDivElement>;
  index: number;
  columns: GuideColumn[];
  panelId: (index: number) => string;
  tabId: (index: number) => string;
  /** Let the active dot follow the scroll position (`--dot`, set by the carousel) instead of jumping to the index. */
  follow: boolean;
  onGo: (index: number) => void;
};

const SHIFT_PX = 6;

export function ColumnGuide({ ref, index, columns, panelId, tabId, follow, onGo }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [seen, setSeen] = useState({ index, direction: 0 });
  const direction = seen.index === index ? seen.direction : Math.sign(index - seen.index);
  if (seen.index !== index) setSeen({ index, direction });
  const { left, current, right } = guideLabels(index);
  const { status } = COLUMNS[index];
  const { shown, total } = columns[index];
  const overLimit = status === "IN_PROGRESS" && total > WIP_LIMIT;
  const dot = follow ? `var(--dot, ${index})` : String(index);

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
    <div ref={ref} className="flex flex-col items-center gap-1.5">
      <div aria-hidden="true" className="relative w-full">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: direction * SHIFT_PX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs leading-5"
          >
            <span className="truncate text-muted-foreground">{left && `‹ ${left}`}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              <span className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
              {current}
              <span className={cn("font-normal tabular-nums", overLimit ? "text-[color:var(--alert)]" : "text-muted-foreground")}>
                · {overLimit ? `${total} / ${WIP_LIMIT}` : shown}
              </span>
            </span>
            <span className="truncate text-right text-muted-foreground">{right && `${right} ›`}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div
        role="tablist"
        aria-label="Board columns"
        onKeyDown={onKeyDown}
        className="relative flex items-center [--pitch:24px] pointer-coarse:[--pitch:44px]"
      >
        {COLUMNS.map(({ status: s, label }, i) => (
          <button
            key={s}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={tabId(i)}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls={panelId(i)}
            aria-label={`Go to ${label}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => go(i)}
            className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
          >
            <span className="size-1.5 rounded-full bg-border" />
          </button>
        ))}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-[calc(var(--pitch)/2-3px)] size-1.5 rounded-full bg-primary"
          style={{ transform: `translate(calc(${dot} * var(--pitch)), -50%)` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        Showing {current}, {shown} {shown === 1 ? "task" : "tasks"}
      </p>
    </div>
  );
}
