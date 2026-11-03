"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { indexFromScroll } from "./carousel";
import { ColumnGuide, type GuideColumn } from "./ColumnGuide";
import { COLUMNS, type Status } from "./dnd";

const START = COLUMNS.findIndex((c) => c.status === "IN_PROGRESS");
const panelId = (i: number) => `carousel-${COLUMNS[i].status}`;

type Props = {
  columns: GuideColumn[];
  dragging: boolean;
  renderColumn: (status: Status, label: string) => ReactNode;
};

export function MobileBoard({ columns, dragging, renderColumn }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const [index, setIndex] = useState(START);

  function leftOf(i: number): number {
    const el = scroller.current;
    const panel = panels.current[i];
    if (!el || !panel) return 0;
    return panel.offsetLeft - (el.clientWidth - panel.offsetWidth) / 2;
  }

  function pageWidth(): number {
    const [a, b] = panels.current;
    return a && b ? b.offsetLeft - a.offsetLeft : 0;
  }

  function go(i: number) {
    setIndex(i);
    scroller.current?.scrollTo({ left: leftOf(i) });
  }

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ left: leftOf(START), behavior: "instant" });
  }, []);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onScroll = () => {
        clearTimeout(timer);
        timer = setTimeout(() => setIndex(indexFromScroll(root.scrollLeft, pageWidth(), COLUMNS.length)), 80);
      };
      root.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        clearTimeout(timer);
        root.removeEventListener("scroll", onScroll);
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = panels.current.indexOf(entry.target as HTMLDivElement);
          if (i >= 0) setIndex(i);
        }
      },
      { root, threshold: 0.6 },
    );
    for (const panel of panels.current) if (panel) observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const wasDragging = useRef(false);
  useEffect(() => {
    const root = scroller.current;
    if (wasDragging.current && !dragging && root) {
      const i = indexFromScroll(root.scrollLeft, pageWidth(), COLUMNS.length);
      setIndex(i);
      root.scrollTo({ left: leftOf(i) });
    }
    wasDragging.current = dragging;
  }, [dragging]);

  return (
    <div className="flex flex-col gap-2">
      <ColumnGuide index={index} columns={columns} panelId={panelId} onGo={go} />
      <div
        ref={scroller}
        data-carousel
        className={cn(
          "relative -mx-4 flex min-[600px]:-mx-6 h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] min-h-[60dvh] gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 [scrollbar-width:none] motion-reduce:scroll-auto",
          dragging ? "snap-none" : "snap-x snap-mandatory scroll-smooth",
        )}
      >
        {COLUMNS.map(({ status, label }, i) => (
          <div
            key={status}
            id={panelId(i)}
            ref={(el) => {
              panels.current[i] = el;
            }}
            className="flex w-[calc(100vw-3rem)] shrink-0 snap-center flex-col"
          >
            {renderColumn(status, label)}
          </div>
        ))}
      </div>
    </div>
  );
}
