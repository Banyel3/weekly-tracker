"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { TaskDto } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { nextColumnFirst } from "./carousel";
import { COLUMNS, type Status } from "./dnd";
import { statusVar } from "./Column";

const labelOf = (status: Status) => COLUMNS.find((c) => c.status === status)?.label ?? status;

type Props = {
  task: TaskDto | null;
  onMove: (task: TaskDto, to: Status) => void;
  onClose: () => void;
};

export function MoveSheet({ task, onMove, onClose }: Props) {
  const order = task ? nextColumnFirst(task.status) : [];
  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-1 rounded-t-2xl border-x-0 bg-card px-3 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] data-[state=closed]:duration-150 data-[state=open]:duration-200"
      >
        <SheetTitle className="px-2 text-[15px] leading-5 font-medium">Move</SheetTitle>
        <SheetDescription className="line-clamp-1 px-2 text-xs">{task?.title}</SheetDescription>
        <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0">
          {order.map((status, i) => {
            const current = status === task?.status;
            return (
              <li key={status}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => {
                    if (!task) return;
                    onMove(task, status);
                    onClose();
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground",
                    !current && "hover:bg-accent",
                    i === 0 && "font-medium",
                  )}
                >
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: statusVar(status) }} />
                  {i === 0 ? `Next: ${labelOf(status)}` : labelOf(status)}
                  {current && " (current)"}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
