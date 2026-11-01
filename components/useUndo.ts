"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { UNDO_MS } from "../lib/constants";
import { ymdToDate } from "../lib/week";

export type UndoAction = {
  label: string;
  undo: () => Promise<void> | void;
  /** Runs once when the window closes, a newer action replaces this one, or the page hides. */
  commit?: () => Promise<void> | void;
};
export type UndoLineState = { id: number; label: string };

export const movedLabel = (title: string, column: string) => `moved “${title}” to ${column}`;
export const deletedLabel = (title: string) => `deleted “${title}”`;
export const rescheduledLabel = (title: string, ymd: string) =>
  `rescheduled “${title}” to ${formatInTimeZone(ymdToDate(ymd), "UTC", "MMM d")}`;

export function createUndoSlot(onChange: (line: UndoLineState | null) => void, ms: number = UNDO_MS) {
  let current: UndoAction | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  function take(): UndoAction | null {
    if (timer) clearTimeout(timer);
    timer = null;
    const action = current;
    current = null;
    return action;
  }

  function flush() {
    const action = take();
    onChange(null);
    void action?.commit?.();
  }

  return {
    register(action: UndoAction) {
      void take()?.commit?.();
      current = action;
      timer = setTimeout(flush, ms);
      onChange({ id: ++seq, label: action.label });
    },
    async undo() {
      const action = take();
      onChange(null);
      await action?.undo();
    },
    flush,
  };
}

export type UndoSlot = ReturnType<typeof createUndoSlot>;
export type UndoState = UndoSlot & { line: UndoLineState | null };

export function useUndoState(): UndoState {
  const [line, setLine] = useState<UndoLineState | null>(null);
  const [slot] = useState(() => createUndoSlot(setLine));

  useEffect(() => {
    const onHide = () => slot.flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [slot]);

  return useMemo(() => ({ ...slot, line }), [slot, line]);
}

export const UndoContext = createContext<UndoState | null>(null);

export function useUndo(): UndoState {
  const value = useContext(UndoContext);
  if (!value) throw new Error("useUndo must be used inside <BoardProvider>");
  return value;
}
