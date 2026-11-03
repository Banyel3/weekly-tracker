"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { TRANSITION } from "./motion/config";
import { useBoard, type BoardState } from "./useBoard";
import { FiltersContext, useFiltersState } from "./useFilters";
import { TaskDialogContext, useTaskDialogState } from "./useTaskDialog";
import { ReviewContext, useReviewState } from "./useReview";
import { UndoContext, useUndoState } from "./useUndo";

const BoardContext = createContext<BoardState | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const undo = useUndoState();
  const board = useBoard(undo.register);
  const review = useReviewState(board.status, board.version);
  const filters = useFiltersState();
  const dialog = useTaskDialogState();
  const pathname = usePathname();
  const { clear } = filters;

  useEffect(() => clear(), [pathname, clear]);

  return (
    <MotionConfig reducedMotion="user" transition={TRANSITION}>
      <UndoContext.Provider value={undo}>
        <BoardContext.Provider value={board}>
          <ReviewContext.Provider value={review}>
            <FiltersContext.Provider value={filters}>
              <TaskDialogContext.Provider value={dialog}>{children}</TaskDialogContext.Provider>
            </FiltersContext.Provider>
          </ReviewContext.Provider>
        </BoardContext.Provider>
      </UndoContext.Provider>
    </MotionConfig>
  );
}

export function useBoardContext(): BoardState {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoardContext must be used inside <BoardProvider>");
  return value;
}
