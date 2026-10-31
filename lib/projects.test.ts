import { describe, expect, it } from "vitest";
import { createProjectSchema, PROJECT_COLORS } from "./projects";

describe("createProjectSchema", () => {
  it("trims the name and accepts every color key", () => {
    for (const color of PROJECT_COLORS) {
      expect(createProjectSchema.parse({ name: "  Work  ", color })).toEqual({ name: "Work", color });
    }
  });

  it("rejects empty, over-long names and unknown colors", () => {
    expect(createProjectSchema.safeParse({ name: "   ", color: "rose" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "x".repeat(41), color: "rose" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "x".repeat(40), color: "rose" }).success).toBe(true);
    expect(createProjectSchema.safeParse({ name: "Work", color: "red" }).success).toBe(false);
  });
});
