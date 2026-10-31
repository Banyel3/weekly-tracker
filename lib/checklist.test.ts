import { describe, expect, it } from "vitest";
import { checklistSchema, normalizeChecklist, readChecklist } from "./checklist";

describe("checklistSchema", () => {
  it("accepts up to 20 items and rejects 21", () => {
    const item = { id: "a", text: "x", done: false };
    expect(checklistSchema.safeParse(Array(20).fill(item)).success).toBe(true);
    expect(checklistSchema.safeParse(Array(21).fill(item)).success).toBe(false);
  });

  it("rejects text over 120 chars after trimming and accepts 120", () => {
    expect(checklistSchema.safeParse([{ text: "x".repeat(121), done: false }]).success).toBe(false);
    expect(checklistSchema.safeParse([{ text: ` ${"x".repeat(120)} `, done: false }]).success).toBe(true);
  });

  it("rejects a non-boolean done and a missing text", () => {
    expect(checklistSchema.safeParse([{ text: "a", done: "yes" }]).success).toBe(false);
    expect(checklistSchema.safeParse([{ done: true }]).success).toBe(false);
  });
});

describe("normalizeChecklist", () => {
  it("trims, drops empty items, keeps order and existing ids", () => {
    const items = checklistSchema.parse([
      { id: "a", text: "  first ", done: true },
      { id: "b", text: "   ", done: false },
      { id: "c", text: "third", done: false },
    ]);
    expect(normalizeChecklist(items)).toEqual([
      { id: "a", text: "first", done: true },
      { id: "c", text: "third", done: false },
    ]);
  });

  it("assigns a uuid when the id is missing and defaults done to false", () => {
    const [item] = normalizeChecklist(checklistSchema.parse([{ text: "new" }]));
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.done).toBe(false);
  });

  it("caps at 20 items", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), text: `t${i}`, done: false }));
    expect(normalizeChecklist(many)).toHaveLength(20);
  });
});

describe("readChecklist", () => {
  it("returns a stored array and falls back to [] for malformed JSON", () => {
    expect(readChecklist([{ id: "a", text: "x", done: true }])).toEqual([{ id: "a", text: "x", done: true }]);
    expect(readChecklist({ nope: 1 })).toEqual([]);
  });
});
