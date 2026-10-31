"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectColor, ProjectDto } from "@/lib/projects";
import type { TaskDto } from "@/lib/tasks";
import { todayYmd, type WeekRange } from "@/lib/week";

type Status = TaskDto["status"];
export type TaskPatch = Partial<Pick<TaskDto, "title" | "note" | "dueDate" | "status" | "projectId">>;
export type NewTask = Pick<TaskDto, "title" | "note" | "dueDate" | "status" | "projectId">;
export type NewProject = { name: string; color: ProjectColor };
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

export function useBoard() {
  const [week, setWeek] = useState<WeekRange | null>(null);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<BoardError>(null);
  const failed = useRef<(() => void) | null>(null);

  const replace = (id: string, next: TaskDto) => setTasks((ts) => ts.map((t) => (t.id === id ? next : t)));
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
    const data: { week: WeekRange; projects: ProjectDto[]; tasks: TaskDto[] } = await res.json();
    setWeek(data.week);
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
      createdAt: now,
      updatedAt: now,
    };
    setTasks((ts) => [...ts, temp]);
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
    setProjects((ps) => [...ps, project].sort((a, b) => a.name.localeCompare(b.name)));
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
    return null;
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

  return { week, projects, tasks, status, error, reload, moveTask, addTask, addProject, updateTask, removeTask, retry };
}
