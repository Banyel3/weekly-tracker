import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskCard } from "./board/TaskCard";
import { isSaving, tempTaskId } from "./savingTask";

describe("isSaving", () => {
  it("marks optimistic ids as saving and server ids as saved", () => {
    expect(isSaving({ id: tempTaskId() })).toBe(true);
    expect(isSaving({ id: "cmh1x2y3z0000abcd" })).toBe(false);
  });
});

describe("a card still saving", () => {
  it("renders as a dimmed card with its title, no move action and no error copy", () => {
    const task = {
      id: tempTaskId(),
      title: "Fresh card",
      note: null,
      dueDate: null,
      status: "THIS_WEEK",
      weekOf: null,
      rolledBackAt: null,
      projectId: null,
      priority: "NONE",
      checklist: [],
      rolloverCount: 0,
      completedAt: null,
      archived: false,
      createdAt: "2026-11-03T00:00:00.000Z",
      updatedAt: "2026-11-03T00:00:00.000Z",
    } as const;
    const html = renderToStaticMarkup(
      createElement(TaskCard, {
        task: { ...task, checklist: [] },
        project: null,
        week: { start: "2026-11-02", end: "2026-11-08" },
        onOpen: () => {},
        onMove: () => {},
      }),
    );
    expect(html).toContain("Fresh card");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain("Move “Fresh card”");
    expect(html).not.toMatch(/couldn.t save/);
  });
});
