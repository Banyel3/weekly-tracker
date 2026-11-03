"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useBoard, type BoardState } from "./useBoard";
import { FiltersContext, useFiltersState } from "./useFilters";
import { TaskDialogContext, useTaskDialogState } from "./useTaskDialog";
import { UndoContext, useUndoState } from "./useUndo";

const BoardContext = createContext<BoardState | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const undo = useUndoState();
  const board = useBoard(undo.register);
  const filters = useFiltersState();
  const dialog = useTaskDialogState();
  const pathname = usePathname();
  const { clear } = filters;

  useEffect(() => clear(), [pathname, clear]);

  return (
    <UndoContext.Provider value={undo}>
      <BoardContext.Provider value={board}>
        <FiltersContext.Provider value={filters}>
          <TaskDialogContext.Provider value={dialog}>{children}</TaskDialogContext.Provider>
        </FiltersContext.Provider>
      </BoardContext.Provider>
    </UndoContext.Provider>
  );
}

export function useBoardContext(): BoardState {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoardContext must be used inside <BoardProvider>");
  return value;
}
