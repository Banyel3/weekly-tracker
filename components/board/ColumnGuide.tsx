"use client";

import { useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { WIP_LIMIT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { guideLabels, pageStart } from "./carousel";
import { COLUMNS, statusVar } from "./status";

export type GuideColumn = { shown: number; total: number };

type Props = {
  ref?: Ref<HTMLDivElement>;
  index: number;
  /** Columns per page: 1 on phones, 2 on tablets. */
  size: number;
  columns: GuideColumn[];
  panelId: (index: number) => string;
  tabId: (index: number) => string;
  /** Let the active dot follow the scroll position (`--dot`, set by the carousel) instead of jumping to the index. */
  follow: boolean;
  onGo: (index: number) => void;
};

const SHIFT_PX = 6;

export function ColumnGuide({ ref, index, size, columns, panelId, tabId, follow, onGo }: Props) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [seen, setSeen] = useState({ index, direction: 0 });
  const direction = seen.index === index ? seen.direction : Math.sign(index - seen.index);
  if (seen.index !== index) setSeen({ index, direction });
  const { left, current, right } = guideLabels(index, size);
  const page = COLUMNS.slice(index, index + size);
  const { shown, total } = columns[index];
  const pageShown = columns.slice(index, index + size).reduce((sum, c) => sum + c.shown, 0);
  const overLimit = page[0].status === "IN_PROGRESS" && total > WIP_LIMIT;
  const dot = follow ? `var(--dot, ${index})` : String(index);

  function go(next: number) {
    const i = Math.min(COLUMNS.length - 1, Math.max(0, next));
    onGo(i);
    tabs.current[pageStart(i, size)]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home") go(0);
    else if (e.key === "End") go(COLUMNS.length - 1);
    else if (step) go(index + step * size);
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
            exit={{ opacity: 0, transition: { duration: 0 } }}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs leading-5"
          >
            <span className="flex min-w-0 items-center gap-1 justify-self-start text-muted-foreground">
              {left && (
                <>
                  <Icon icon={ChevronLeft} size="sm" />
                  <span className="truncate">{left}</span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-2.5 text-sm font-medium whitespace-nowrap">
              {page.map(({ status, label }, i) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="mr-1 text-muted-foreground">·</span>}
                  <span className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
                  {label}
                </span>
              ))}
              {size === 1 && (
                <span className={cn("text-xs font-normal tabular-nums", overLimit ? "text-[color:var(--alert)]" : "text-muted-foreground")}>
                  {overLimit ? `${total} / ${WIP_LIMIT}` : shown}
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center justify-end gap-1 justify-self-end text-muted-foreground">
              {right && (
                <>
                  <span className="truncate">{right}</span>
                  <Icon icon={ChevronRight} size="sm" />
                </>
              )}
            </span>
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
            aria-selected={i >= index && i < index + size}
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
          className="pointer-events-none absolute top-1/2 left-[calc(var(--pitch)/2-3px)] h-1.5 rounded-full bg-primary"
          style={{ width: `calc(${size - 1} * var(--pitch) + 6px)`, transform: `translate(calc(${dot} * var(--pitch)), -50%)` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        Showing {current}, {pageShown} {pageShown === 1 ? "task" : "tasks"}
      </p>
    </div>
  );
}
