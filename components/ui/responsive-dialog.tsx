"use client";

import { useRef, type ComponentProps, type PointerEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { shouldDismiss } from "@/components/gestures";
import { EASE_OUT_CSS } from "@/components/motion/config";
import { useIsPhone } from "@/components/useMediaQuery";
import { cn } from "@/lib/utils";

type DragState = { startY: number; lastY: number; lastT: number; velocity: number };

/** Drag the handle down to dismiss; translateY follows the finger and glides back short of the threshold. */
function useDragToDismiss(onDismiss: () => void) {
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  function setOffset(px: number, animate: boolean) {
    const el = content.current;
    if (!el) return;
    el.style.transition = animate ? `transform 150ms ${EASE_OUT_CSS}` : "none";
    el.style.transform = px ? `translateY(${px}px)` : "";
  }

  return {
    content,
    handle: {
      onPointerDown(e: PointerEvent<HTMLDivElement>) {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
      },
      onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        if (!d) return;
        const dt = e.timeStamp - d.lastT;
        if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
        d.lastY = e.clientY;
        d.lastT = e.timeStamp;
        setOffset(Math.max(0, e.clientY - d.startY), false);
      },
      onPointerUp(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const offset = e.clientY - d.startY;
        if (shouldDismiss(offset, d.velocity)) onDismiss();
        else setOffset(0, true);
      },
      onPointerCancel() {
        drag.current = null;
        setOffset(0, true);
      },
    },
  };
}

type ContentProps = ComponentProps<typeof DialogContent> & {
  /** Classes for the centred dialog only (900px and up). */
  dialogClassName?: string;
  /** Called when the bottom sheet is dragged away. */
  onDismiss: () => void;
};

export const ResponsiveDialog = Dialog;

export function ResponsiveDialogContent({ className, dialogClassName, onDismiss, children, ...props }: ContentProps) {
  const phone = useIsPhone();
  const { content, handle } = useDragToDismiss(onDismiss);
  if (!phone) {
    return (
      <DialogContent className={cn(className, dialogClassName)} {...props}>
        {children}
      </DialogContent>
    );
  }
  return (
    <SheetContent
      ref={content}
      side="bottom"
      className={cn(
        className,
        "max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl border-x-0 pt-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] [scroll-padding-bottom:50vh]",
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        {...handle}
        className="sticky top-0 z-10 -mx-5 mb-1 flex h-6 shrink-0 cursor-grab touch-none items-center justify-center bg-inherit pointer-coarse:h-8"
      >
        <span className="h-1 w-9 rounded-full bg-border" />
      </div>
      {children}
    </SheetContent>
  );
}
