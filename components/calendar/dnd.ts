import type { Active, Announcements, KeyboardCodes, KeyboardCoordinateGetter } from "@dnd-kit/core";
import { shiftYmd } from "@/lib/week";
import { dayId, dayLabel, ymdOfDayId } from "./calendar";

export type ChipData = { taskId: string; title: string; dueDate: string };

export const CAL_KEYBOARD_CODES: KeyboardCodes = {
  start: ["Space"],
  cancel: ["Escape"],
  end: ["Space"],
};

export const CAL_INSTRUCTIONS = {
  draggable:
    "Press Space to pick up the task. Use the left and right arrow keys to move it a day, Space to drop, Escape to cancel. Press Enter to open it.",
};

const chip = (active: Active) => active.data.current as ChipData | undefined;

export const dayCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) return undefined;
  event.preventDefault();
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  const from = context.over ? ymdOfDayId(context.over.id) : context.active ? chip(context.active)?.dueDate : undefined;
  if (!step || !from) return undefined;
  const rect = context.droppableRects.get(dayId(shiftYmd(from, step)));
  const card = context.collisionRect;
  if (!rect || !card) return undefined;
  return { x: rect.left + (rect.width - card.width) / 2, y: rect.top + Math.min(40, rect.height / 2) };
};

const cancelled = "Reschedule cancelled.";

export const calAnnouncements: Announcements = {
  onDragStart: ({ active }) => `Picked up “${chip(active)?.title ?? ""}”.`,
  onDragOver: ({ over }) => (over ? `Over ${dayLabel(ymdOfDayId(over.id))}.` : undefined),
  onDragEnd: ({ active, over }) => {
    if (!over) return cancelled;
    const to = ymdOfDayId(over.id);
    return to === chip(active)?.dueDate ? `Left on ${dayLabel(to)}.` : `Rescheduled to ${dayLabel(to)}.`;
  },
  onDragCancel: () => cancelled,
};

/** Arrow keys walk chips while nothing is picked up: up/down within a day, left/right across days. */
export function moveChipFocus(event: React.KeyboardEvent<HTMLElement>) {
  const step = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[event.key];
  const root = event.currentTarget.closest("[data-cal-root]");
  if (!step || !root) return;
  const chips = [...root.querySelectorAll<HTMLElement>("[data-cal-chip]")];
  const days = [...new Set(chips.map((c) => c.dataset.day ?? ""))];
  const day = event.currentTarget.dataset.day ?? "";
  const inDay = (d: string) => chips.filter((c) => c.dataset.day === d);
  const here = inDay(day);
  const index = here.indexOf(event.currentTarget);
  const next = step[0] ? inDay(days[days.indexOf(day) + step[0]] ?? "")[0] : here[index + step[1]];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
