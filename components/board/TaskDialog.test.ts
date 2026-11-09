import { describe, expect, it } from "vitest";
import { formOf } from "./TaskDialog";

describe("formOf", () => {
  it("presets the due date and status a calendar day asks for", () => {
    const form = formOf({ mode: "create", initialStatus: "FUTURE", dueDate: "2026-11-16" });
    expect(form.dueDate).toBe("2026-11-16");
    expect(form.status).toBe("FUTURE");
  });

  it("leaves the due date empty for a column's Add", () => {
    expect(formOf({ mode: "create", initialStatus: "BACKLOG" }).dueDate).toBe("");
  });
});
