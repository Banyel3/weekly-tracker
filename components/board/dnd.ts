import type { Active, Announcements, KeyboardCodes, KeyboardCoordinateGetter, UniqueIdentifier } from "@dnd-kit/core";
import { COLUMNS, type Status } from "./status";

export { COLUMNS, type Status };
export type CardData = { status: Status; title: string };

const STATUSES = COLUMNS.map((c) => c.status);
const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

export const KEYBOARD_CODES: KeyboardCodes = {
  start: ["Space"],
  cancel: ["Escape"],
  end: ["Space", "Enter"],
};

export const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "Press Space to pick up the task. Use the left and right arrow keys to move it between columns, Space to drop, Escape to cancel. Press Enter to edit.",
};

function labelOf(id: UniqueIdentifier): string {
  return COLUMNS.find((c) => c.status === id)?.label ?? String(id);
}

function titleOf(active: Active): string {
  return (active.data.current as CardData | undefined)?.title ?? "";
}

export const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!ARROWS.includes(event.code)) return undefined;
  event.preventDefault();
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (step === 0) return undefined;
  const from = context.over?.id ?? (context.active?.data.current as CardData | undefined)?.status;
  const target = STATUSES[STATUSES.indexOf(from as Status) + step];
  const rect = target ? context.droppableRects.get(target) : undefined;
  const card = context.collisionRect;
  if (!rect || !card) return undefined;
  return {
    x: rect.left + (rect.width - card.width) / 2,
    y: rect.top + (rect.height - card.height) / 2,
  };
};

export const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up "${titleOf(active)}".`,
  onDragOver: ({ active, over }) => (over ? `"${titleOf(active)}" is over ${labelOf(over.id)}.` : undefined),
  onDragEnd: ({ active, over }) => (over ? `"${titleOf(active)}" moved to ${labelOf(over.id)}.` : "Move cancelled."),
  onDragCancel: () => "Move cancelled.",
};
