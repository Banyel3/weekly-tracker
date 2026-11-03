"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import { localId } from "@/lib/localId";
import type { BoardCounts, BoardDto, TaskDto } from "@/lib/tasks";
import { todayYmd, type WeekRange } from "@/lib/week";
import { COLUMNS } from "./board/dnd";
import { deletedLabel, movedLabel, rescheduledLabel, type UndoSlot } from "./useUndo";

type Status = TaskDto["status"];
type Editable = "title" | "note" | "dueDate" | "status" | "projectId" | "priority" | "checklist";
export type TaskPatch = Partial<Pick<TaskDto, Editable | "rolledBackAt">>;
export type NewTask = Pick<TaskDto, Editable>;
export type NewProject = { name: string; color: ProjectColor };
export type ProjectPatch = Partial<NewProject>;
/** retryable is false for 4xx answers (validation, duplicate name): resending the same request cannot succeed. */
export type ProjectFailure = { message: string; retryable: boolean };
export type LoadStatus = "loading" | "ready" | "error";
export type BoardError = "load" | "save" | null;

const JSON_HEADERS = { "Content-Type": "application/json" };

async function send(url: string, init: RequestInit): Promise<Response | null> {
  return fetch(url, init).catch(() => null);
}

/** keepalive lets a deferred delete flushed on pagehide outlive the page. */
export function sendDelete(url: string): Promise<Response | null> {
  return send(url, { method: "DELETE", keepalive: true });
}

const columnLabel = (status: Status) => COLUMNS.find((c) => c.status === status)?.label ?? status;

function insertAt<T>(items: T[], index: number, item: T): T[] {
  const i = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, i), item, ...items.slice(i)];
}

async function projectFailure(res: Response | null): Promise<ProjectFailure> {
  return { message: await errorText(res), retryable: !res || res.status >= 500 };
}

async function errorText(res: Response | null): Promise<string> {
  if (!res) return "couldn't reach the server";
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

function sortProjects(projects: ProjectDto[]): ProjectDto[] {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}

export function useBoard(register: UndoSlot["register"]) {
  const [week, setWeek] = useState<WeekRange | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [counts, setCounts] = useState<BoardCounts>({ live: 0, archived: 0, nudges: 0 });
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<BoardError>(null);
  const [version, setVersion] = useState(0);
  const failed = useRef<(() => void) | null>(null);
  const hiddenTasks = useRef(new Set<string>());
  const hiddenProjects = useRef(new Set<string>());
  const latest = useRef({ projects, tasks });
  latest.current = { projects, tasks };

  const replace = (id: string, next: TaskDto) => setTasks((ts) => ts.map((t) => (t.id === id ? next : t)));
  const bumpLive = (by: number) => setCounts((c) => ({ ...c, live: Math.max(0, c.live + by) }));
  const bump = () => setVersion((v) => v + 1);
  const clearSaveError = () => setError((e) => (e === "save" ? null : e));
  const fail = (again: () => void) => {
    failed.current = again;
    setError("save");
  };

  const reload = useCallback(async () => {
    const res = await send("/api/board", { cache: "no-store" });
    if (!res?.ok) {
      setStatus((s) => (s === "ready" ? s : "error"));
      setError("load");
      return;
    }
    const data: BoardDto = await res.json();
    setWeek(data.week);
    setToday(data.today);
    setCounts(data.counts);
    const goneProject = (id: string | null) => id !== null && hiddenProjects.current.has(id);
    setProjects(data.projects.filter((p) => !goneProject(p.id)));
    setTasks(
      data.tasks
        .filter((t) => !hiddenTasks.current.has(t.id))
        .map((t) => (goneProject(t.projectId) ? { ...t, projectId: null } : t)),
    );
    setStatus("ready");
    setError((e) => (e === "load" ? null : e));
    bump();
  }, []);

  const patchTask = useCallback(async (id: string, patch: TaskPatch): Promise<Response | null> => {
    return send(`/api/tasks/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(patch) });
  }, []);

  const undoMove = useCallback(
    async (before: TaskDto, after: TaskDto) => {
      clearSaveError();
      replace(before.id, before);
      const res = await patchTask(before.id, { status: before.status, rolledBackAt: before.rolledBackAt });
      if (res?.ok) {
        replace(before.id, await res.json());
        bump();
        return;
      }
      replace(before.id, after);
      fail(() => undoMove(before, after));
    },
    [patchTask],
  );

  const moveTask = useCallback(
    async (task: TaskDto, to: Status): Promise<boolean> => {
      clearSaveError();
      replace(task.id, { ...task, status: to, rolledBackAt: null });
      const res = await patchTask(task.id, { status: to });
      if (!res?.ok) {
        replace(task.id, task);
        fail(() => moveTask(task, to));
        return false;
      }
      const moved: TaskDto = await res.json();
      replace(task.id, moved);
      bump();
      register({ label: movedLabel(task.title, columnLabel(to)), undo: () => undoMove(task, moved) });
      return true;
    },
    [patchTask, undoMove, register],
  );

  const addTask = useCallback(async (body: NewTask) => {
    clearSaveError();
    const now = new Date().toISOString();
    const temp: TaskDto = {
      ...body,
      id: `tmp-${localId()}`,
      weekOf: null,
      rolledBackAt: null,
      rolloverCount: 0,
      completedAt: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    setTasks((ts) => [...ts, temp]);
    bumpLive(1);
    const res = await send("/api/tasks", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (res?.ok) {
      replace(temp.id, await res.json());
      bump();
      return;
    }
    setTasks((ts) => ts.filter((t) => t.id !== temp.id));
    bumpLive(-1);
    fail(() => addTask(body));
  }, []);

  const addProject = useCallback(async (input: NewProject): Promise<ProjectDto> => {
    const res = await send("/api/projects", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    });
    if (!res?.ok) throw new Error(await errorText(res));
    const project: ProjectDto = await res.json();
    setProjects((ps) => sortProjects([...ps, project]));
    bump();
    return project;
  }, []);

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch): Promise<string | null> => {
      const res = await patchTask(id, patch);
      if (!res?.ok) return errorText(res);
      replace(id, await res.json());
      bump();
      return null;
    },
    [patchTask],
  );

  const rescheduleTask = useCallback(
    async function reschedule(task: TaskDto, dueDate: string, undoable = true): Promise<void> {
      clearSaveError();
      replace(task.id, { ...task, dueDate });
      const res = await patchTask(task.id, { dueDate });
      if (!res?.ok) {
        replace(task.id, task);
        fail(() => reschedule(task, dueDate, undoable));
        return;
      }
      const moved: TaskDto = await res.json();
      replace(task.id, moved);
      bump();
      if (undoable && task.dueDate) {
        const previous = task.dueDate;
        register({ label: rescheduledLabel(task.title, dueDate), undo: () => reschedule(moved, previous, false) });
      }
    },
    [patchTask, register],
  );

  const removeTask = useCallback(
    (task: TaskDto) => {
      const index = latest.current.tasks.findIndex((t) => t.id === task.id);
      if (index < 0) return;
      const restore = () => {
        hiddenTasks.current.delete(task.id);
        setTasks((ts) => (ts.some((t) => t.id === task.id) ? ts : insertAt(ts, index, task)));
        bumpLive(1);
      };
      hiddenTasks.current.add(task.id);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
      bumpLive(-1);
      register({
        label: deletedLabel(task.title),
        undo: restore,
        commit: async () => {
          const res = await sendDelete(`/api/tasks/${task.id}`);
          if (res?.ok || res?.status === 404) {
            hiddenTasks.current.delete(task.id);
            bump();
            return;
          }
          restore();
          fail(() => removeTask(task));
        },
      });
    },
    [register],
  );

  const updateProject = useCallback(async (id: string, patch: ProjectPatch): Promise<ProjectFailure | null> => {
    const previous = latest.current.projects.find((p) => p.id === id);
    if (!previous) return null;
    const put = (next: ProjectDto) => setProjects((ps) => sortProjects(ps.map((p) => (p.id === id ? next : p))));
    put({ ...previous, ...patch });
    const res = await send(`/api/projects/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
    if (res?.ok) {
      put(await res.json());
      bump();
      return null;
    }
    put(previous);
    return projectFailure(res);
  }, []);

  const removeProject = useCallback(
    (id: string, onFailure: (failure: ProjectFailure) => void) => {
      const index = latest.current.projects.findIndex((p) => p.id === id);
      if (index < 0) return;
      const removed = latest.current.projects[index];
      const orphaned = new Set(latest.current.tasks.filter((t) => t.projectId === id).map((t) => t.id));
      const restore = () => {
        hiddenProjects.current.delete(id);
        setProjects((ps) => (ps.some((p) => p.id === id) ? ps : sortProjects([...ps, removed])));
        setTasks((ts) => ts.map((t) => (orphaned.has(t.id) && t.projectId === null ? { ...t, projectId: id } : t)));
      };
      hiddenProjects.current.add(id);
      setProjects((ps) => ps.filter((p) => p.id !== id));
      setTasks((ts) => ts.map((t) => (orphaned.has(t.id) ? { ...t, projectId: null } : t)));
      register({
        label: deletedLabel(removed.name),
        undo: restore,
        commit: async () => {
          const res = await sendDelete(`/api/projects/${id}`);
          if (res?.ok || res?.status === 404) {
            hiddenProjects.current.delete(id);
            bump();
            return;
          }
          restore();
          onFailure(await projectFailure(res));
        },
      });
    },
    [register],
  );

  const retry = useCallback(() => {
    const again = error === "save" ? failed.current : reload;
    setError(null);
    again?.();
  }, [error, reload]);

  useEffect(() => {
    reload();
    let day = todayYmd();
    const tick = setInterval(() => {
      const today = todayYmd();
      if (today === day) return;
      day = today;
      reload();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const onFocus = () => reload();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  return {
    week,
    today,
    counts,
    projects,
    tasks,
    status,
    error,
    version,
    reload,
    moveTask,
    addTask,
    addProject,
    updateProject,
    removeProject,
    updateTask,
    rescheduleTask,
    removeTask,
    retry,
  };
}

export type BoardState = ReturnType<typeof useBoard>;
