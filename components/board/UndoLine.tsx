"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUndo } from "../useUndo";

type Props = { className?: string; returnFocusTo?: string };

export function UndoLine({ className, returnFocusTo }: Props) {
  const { line, undo } = useUndo();
  const focused = useRef(false);

  useEffect(() => {
    if (line || !focused.current) return;
    focused.current = false;
    if (returnFocusTo) document.getElementById(returnFocusTo)?.focus();
  }, [line, returnFocusTo]);

  return (
    <span aria-live="polite" className={cn("min-w-0 text-xs text-muted-foreground", className)}>
      {line && (
        <span key={line.id}>
          {line.label} ·{" "}
          <button
            type="button"
            data-undo-button
            onFocus={() => (focused.current = true)}
            onBlur={() => (focused.current = false)}
            onClick={() => void undo()}
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-2"
          >
            undo
          </button>
        </span>
      )}
    </span>
  );
}
