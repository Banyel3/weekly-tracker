"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import type { BoardCounts, BoardDto, TaskDto } from "@/lib/tasks";
import { todayYmd, type WeekRange } from "@/lib/week";

type Status = TaskDto["status"];
export type TaskPatch = Partial<Pick<TaskDto, "title" | "note" | "dueDate" | "status" | "projectId">>;
export type NewTask = Pick<TaskDto, "title" | "note" | "dueDate" | "status" | "projectId">;
export type NewProject = { name: string; color: ProjectColor };
export type ProjectPatch = Partial<NewProject>;
export type LoadStatus = "loading" | "ready" | "error";
export type BoardError = "load" | "save" | null;

const JSON_HEADERS = { "Content-Type": "application/json" };

function tempId(): string {
  const uuid =
    typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `tmp-${uuid}`;
}

async function send(url: string, init: RequestInit): Promise<Response | null> {
  return fetch(url, init).catch(() => null);
}

async function errorText(res: Response | null): Promise<string> {
  if (!res) return "couldn't reach the server";
  const body = await res.json().catch(() => null);
  return body?.error ?? `request failed (${res.status})`;
}

function sortProjects(projects: ProjectDto[]): ProjectDto[] {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}

export function useBoard() {
  const [week, setWeek] = useState<WeekRange | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [counts, setCounts] = useState<BoardCounts>({ live: 0, archived: 0, nudges: 0 });
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<BoardError>(null);
  const failed = useRef<(() => void) | null>(null);
  const latest = useRef({ projects, tasks });
  latest.current = { projects, tasks };

  const replace = (id: string, next: TaskDto) => setTasks((ts) => ts.map((t) => (t.id === id ? next : t)));
  const bumpLive = (by: number) => setCounts((c) => ({ ...c, live: Math.max(0, c.live + by) }));
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
    setProjects(data.projects);
    setTasks(data.tasks);
    setStatus("ready");
    setError((e) => (e === "load" ? null : e));
  }, []);

  const moveTask = useCallback(async (task: TaskDto, to: Status) => {
    clearSaveError();
    replace(task.id, { ...task, status: to, rolledBackAt: null });
    const res = await send(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: to }),
    });
    if (res?.ok) {
      replace(task.id, await res.json());
      return;
    }
    replace(task.id, task);
    fail(() => moveTask(task, to));
  }, []);

  const addTask = useCallback(async (body: NewTask) => {
    clearSaveError();
    const now = new Date().toISOString();
    const temp: TaskDto = {
      ...body,
      id: tempId(),
      weekOf: null,
      rolledBackAt: null,
      priority: "NONE",
      checklist: [],
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
    return project;
  }, []);

  const updateTask = useCallback(async (id: string, patch: TaskPatch): Promise<string | null> => {
    const res = await send(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
    if (!res?.ok) return errorText(res);
    replace(id, await res.json());
    return null;
  }, []);

  const removeTask = useCallback(async (id: string): Promise<string | null> => {
    const res = await send(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res?.ok && res?.status !== 404) return errorText(res);
    setTasks((ts) => ts.filter((t) => t.id !== id));
    if (res?.ok) bumpLive(-1);
    return null;
  }, []);

  const updateProject = useCallback(async (id: string, patch: ProjectPatch): Promise<string | null> => {
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
      return null;
    }
    put(previous);
    return errorText(res);
  }, []);

  const removeProject = useCallback(async (id: string): Promise<string | null> => {
    const removed = latest.current.projects.find((p) => p.id === id);
    if (!removed) return null;
    const orphaned = new Set(latest.current.tasks.filter((t) => t.projectId === id).map((t) => t.id));
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setTasks((ts) => ts.map((t) => (orphaned.has(t.id) ? { ...t, projectId: null } : t)));
    const res = await send(`/api/projects/${id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 404) return null;
    setProjects((ps) => sortProjects([...ps, removed]));
    setTasks((ts) => ts.map((t) => (orphaned.has(t.id) && t.projectId === null ? { ...t, projectId: id } : t)));
    return errorText(res);
  }, []);

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
    reload,
    moveTask,
    addTask,
    addProject,
    updateProject,
    removeProject,
    updateTask,
    removeTask,
    retry,
  };
}

export type BoardState = ReturnType<typeof useBoard>;
