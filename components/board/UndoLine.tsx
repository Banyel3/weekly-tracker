"use client";

import { useEffect, useRef } from "react";
import { UNDO_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { haptic } from "../haptics";
import { useIsPhone } from "../useMediaQuery";
import { useUndo } from "../useUndo";

type Props = { className?: string; returnFocusTo?: string };

const UNDO_BUTTON =
  "rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-2";

export function UndoLine({ className, returnFocusTo }: Props) {
  const { line, undo } = useUndo();
  const phone = useIsPhone();
  const focused = useRef(false);

  useEffect(() => {
    if (line || !focused.current) return;
    focused.current = false;
    if (returnFocusTo) document.getElementById(returnFocusTo)?.focus();
  }, [line, returnFocusTo]);

  const button = (
    <button
      type="button"
      data-undo-button
      onFocus={() => (focused.current = true)}
      onBlur={() => (focused.current = false)}
      onClick={() => {
        haptic();
        void undo();
      }}
      className={UNDO_BUTTON}
    >
      undo
    </button>
  );

  if (phone) {
    return (
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] z-40 mx-auto max-w-[480px]"
      >
        {line && (
          <div
            key={line.id}
            className="pointer-events-auto relative flex min-h-11 animate-in items-center gap-3 overflow-hidden rounded-lg border bg-popover py-1 pr-1 pl-3 text-sm text-popover-foreground shadow-lg duration-150 fade-in-0 slide-in-from-bottom-2"
          >
            <span className="min-w-0 flex-1 truncate">{line.label}</span>
            {button}
            <span
              aria-hidden="true"
              style={{ animationDuration: `${UNDO_MS}ms` }}
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-[undo-timer_linear_forwards] bg-primary"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <span aria-live="polite" className={cn("min-w-0 text-xs text-muted-foreground", className)}>
      {line && (
        <span key={line.id}>
          {line.label} · {button}
        </span>
      )}
    </span>
  );
}
