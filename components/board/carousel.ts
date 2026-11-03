import { COLUMNS, type Status } from "./dnd";

export type Guide = { left: string | null; current: string; right: string | null };

const clamp = (i: number) => Math.min(COLUMNS.length - 1, Math.max(0, i));

export function guideLabels(index: number): Guide {
  const i = clamp(index);
  return {
    left: COLUMNS[i - 1]?.label ?? null,
    current: COLUMNS[i].label,
    right: COLUMNS[i + 1]?.label ?? null,
  };
}

export function indexFromScroll(scrollLeft: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));
}

export function nextColumnFirst(current: Status): Status[] {
  const order = COLUMNS.map((c) => c.status);
  const next = order[(order.indexOf(current) + 1) % order.length];
  return [next, ...order.filter((s) => s !== next)];
}

/** Fractional page index for the scroll-linked active dot, clamped to the first and last page. */
export function dotProgress(scrollLeft: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0) return 0;
  return Math.min(count - 1, Math.max(0, scrollLeft / pageWidth));
}
