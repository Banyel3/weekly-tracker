"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { TaskDto } from "@/lib/tasks";
import type { Status } from "./board/dnd";
import { isSaving } from "./savingTask";
import type { DialogTarget } from "./board/TaskDialog";

export type TaskDialogState = {
  target: DialogTarget | null;
  openTask: (task: TaskDto) => void;
  openCreate: (initialStatus: Status) => void;
  close: () => void;
};

export const TaskDialogContext = createContext<TaskDialogState | null>(null);

export function useTaskDialogState(): TaskDialogState {
  const [target, setTarget] = useState<DialogTarget | null>(null);
  const actions = useMemo(
    () => ({
      openTask: (task: TaskDto) => {
        if (!isSaving(task)) setTarget({ mode: "edit", task });
      },
      openCreate: (initialStatus: Status) => setTarget({ mode: "create", initialStatus }),
      close: () => setTarget(null),
    }),
    [],
  );
  return useMemo(() => ({ target, ...actions }), [target, actions]);
}

export function useTaskDialog(): TaskDialogState {
  const value = useContext(TaskDialogContext);
  if (!value) throw new Error("useTaskDialog must be used inside <BoardProvider>");
  return value;
}
