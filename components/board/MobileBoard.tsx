"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../motion/config";
import { useMediaQuery } from "../useMediaQuery";
import { dotProgress, indexFromScroll, pageStart } from "./carousel";
import { ColumnGuide, type GuideColumn } from "./ColumnGuide";
import { COLUMNS, type Status } from "./dnd";

const START = COLUMNS.findIndex((c) => c.status === "IN_PROGRESS");
const FLIGHT_MS = 1000;
/** Tablets (600–899px) show two columns per page. */
const PAIR_QUERY = "(min-width: 600px)";
const panelId = (i: number) => `carousel-${COLUMNS[i].status}`;
const tabId = (i: number) => `carousel-tab-${COLUMNS[i].status}`;

type Props = {
  columns: GuideColumn[];
  dragging: boolean;
  renderColumn: (status: Status, label: string) => ReactNode;
};

export function MobileBoard({ columns, dragging, renderColumn }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const [index, setIndex] = useState(START);
  const reduced = useReducedMotion();
  const size = useMediaQuery(PAIR_QUERY) ? 2 : 1;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  // While a dot or arrow jump scrolls, the panels it passes are not announced; only where it lands is.
  const flight = useRef<{ to: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  function leftOf(i: number): number {
    const el = scroller.current;
    const panel = panels.current[i];
    if (!el || !panel) return 0;
    const last = panels.current[i + sizeRef.current - 1] ?? panel;
    const width = last.offsetLeft + last.offsetWidth - panel.offsetLeft;
    const style = getComputedStyle(el);
    const start = parseFloat(style.scrollPaddingInlineStart) || 0;
    const end = parseFloat(style.scrollPaddingInlineEnd) || 0;
    const snapport = el.clientWidth - start - end;
    return panel.offsetLeft - start - (snapport - width) / 2;
  }

  function pageWidth(): number {
    const [a, b] = panels.current;
    return a && b ? b.offsetLeft - a.offsetLeft : 0;
  }

  const page = (i: number) => pageStart(i, sizeRef.current);
  const fromScroll = (root: HTMLDivElement) => page(indexFromScroll(root.scrollLeft, pageWidth(), COLUMNS.length));

  function land(column: number) {
    const i = page(column);
    if (flight.current) {
      if (i !== flight.current.to) return;
      clearTimeout(flight.current.timer);
      flight.current = null;
    }
    setIndex(i);
  }

  function go(column: number) {
    const i = page(column);
    const left = leftOf(i);
    const root = scroller.current;
    if (i === index && root && Math.abs(root.scrollLeft - left) < 1) return;
    if (flight.current) clearTimeout(flight.current.timer);
    flight.current = { to: i, timer: setTimeout(() => (flight.current = null), FLIGHT_MS) };
    setIndex(i);
    root?.scrollTo({ left });
  }

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ left: leftOf(START), behavior: "instant" });
  }, []);

  const shownSize = useRef(size);
  useLayoutEffect(() => {
    if (shownSize.current === size) return;
    shownSize.current = size;
    const i = page(index);
    setIndex(i);
    scroller.current?.scrollTo({ left: leftOf(i), behavior: "instant" });
  }, [size]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onScroll = () =>
      guide.current?.style.setProperty("--dot", String(dotProgress(root.scrollLeft, pageWidth(), COLUMNS.length)));
    const onEnd = () => {
      if (flight.current) clearTimeout(flight.current.timer);
      flight.current = null;
      setIndex(fromScroll(root));
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("scrollend", onEnd);
    if (typeof IntersectionObserver === "undefined") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onSettle = () => {
        clearTimeout(timer);
        timer = setTimeout(() => land(fromScroll(root)), 80);
      };
      root.addEventListener("scroll", onSettle, { passive: true });
      return () => {
        clearTimeout(timer);
        root.removeEventListener("scroll", onScroll);
        root.removeEventListener("scrollend", onEnd);
        root.removeEventListener("scroll", onSettle);
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = panels.current.indexOf(entry.target as HTMLDivElement);
          if (i >= 0) land(i);
        }
      },
      { root, threshold: 0.6 },
    );
    for (const panel of panels.current) if (panel) observer.observe(panel);
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("scrollend", onEnd);
    };
  }, []);

  useEffect(() => () => clearTimeout(flight.current?.timer), []);

  const wasDragging = useRef(false);
  useEffect(() => {
    const root = scroller.current;
    if (wasDragging.current && !dragging && root) {
      const i = fromScroll(root);
      setIndex(i);
      root.scrollTo({ left: leftOf(i) });
    }
    wasDragging.current = dragging;
  }, [dragging]);

  return (
    <div className="flex flex-col gap-2">
      <ColumnGuide ref={guide} index={index} size={size} columns={columns} panelId={panelId} tabId={tabId} follow={!reduced} onGo={go} />
      <div
        ref={scroller}
        data-carousel
        className={cn(
          "relative -mx-4 flex min-[600px]:-mx-6 h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] min-h-[60dvh] gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 scroll-px-6 [scrollbar-width:none] motion-reduce:scroll-auto",
          dragging ? "snap-none" : "snap-x snap-mandatory scroll-smooth",
        )}
      >
        {COLUMNS.map(({ status, label }, i) => (
          <div
            key={status}
            id={panelId(i)}
            role="tabpanel"
            aria-labelledby={tabId(i)}
            ref={(el) => {
              panels.current[i] = el;
            }}
            className={cn(
              "flex w-[calc(100vw-3rem)] shrink-0 snap-center flex-col min-[600px]:w-[calc(50vw-1.875rem)]",
              i % 2 === 0 ? "min-[600px]:snap-start" : "min-[600px]:snap-align-none",
            )}
          >
            {renderColumn(status, label)}
          </div>
        ))}
      </div>
    </div>
  );
}
