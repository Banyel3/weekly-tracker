import type { Task } from "@prisma/client";

/** Shared by the agent REST route tests. */
export const AGENT_TOKEN = "rest-token";

export const agentRequest = (url: string, init: RequestInit & { token?: string | null } = {}) => {
  const { token = AGENT_TOKEN, headers, ...rest } = init;
  return new Request(`http://test${url}`, {
    ...rest,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(headers as Record<string, string>) },
  });
};

export const taskRow = (over: Partial<Task> = {}) =>
  ({
    id: "t1",
    title: "Write the brief",
    note: null,
    dueDate: null,
    status: "THIS_WEEK",
    weekOf: new Date("2026-11-02T00:00:00.000Z"),
    rolledBackAt: null,
    projectId: null,
    priority: "NONE",
    checklist: [],
    rolloverCount: 0,
    completedAt: null,
    archived: false,
    createdAt: new Date("2026-11-02T01:00:00.000Z"),
    updatedAt: new Date("2026-11-02T01:00:00.000Z"),
    ...over,
  }) as Task;
