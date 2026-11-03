import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dateInput, isYmd, issuesToString, priorityInput, readJsonBody, statusInput } from "./parse";

// Wed 2026-11-04 10:00 Manila; 23:30 UTC on the 3rd is already the 4th in Manila.
const NOW = new Date("2026-11-04T02:00:00.000Z");
const LATE_UTC = new Date("2026-11-03T23:30:00.000Z");

describe("statusInput", () => {
  it.each([
    ["backlog", "BACKLOG"],
    ["THIS_WEEK", "THIS_WEEK"],
    ["In Progress", "IN_PROGRESS"],
    ["in-progress", "IN_PROGRESS"],
    [" Done ", "DONE"],
  ])("maps %j to %s", (input, expected) => {
    expect(statusInput.parse(input)).toBe(expected);
  });

  it("rejects an unknown name with the allowed list", () => {
    const result = statusInput.safeParse("doing");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("status must be one of backlog, this_week, in_progress, done");
  });
});

describe("priorityInput", () => {
  it("maps names case-insensitively", () => {
    expect(priorityInput.parse("URGENT")).toBe("URGENT");
    expect(priorityInput.parse("high")).toBe("HIGH");
    expect(priorityInput.parse("None")).toBe("NONE");
  });

  it("rejects low", () => {
    expect(priorityInput.safeParse("low").success).toBe(false);
  });
});

describe("dateInput", () => {
  it("passes a real YYYY-MM-DD through", () => {
    expect(dateInput(NOW).parse("2026-12-31")).toBe("2026-12-31");
  });

  it("resolves today and tomorrow in Manila", () => {
    expect(dateInput(NOW).parse("today")).toBe("2026-11-04");
    expect(dateInput(NOW).parse("Tomorrow")).toBe("2026-11-05");
    expect(dateInput(LATE_UTC).parse("today")).toBe("2026-11-04");
  });

  it.each(["2026-02-30", "2026-13-01", "11/05/2026", "next week", "2026-1-5"])("rejects %j", (value) => {
    const result = dateInput(NOW).safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("must be YYYY-MM-DD, today or tomorrow");
  });

  it("isYmd checks the calendar", () => {
    expect(isYmd("2028-02-29")).toBe(true);
    expect(isYmd("2026-02-29")).toBe(false);
  });
});

describe("issuesToString", () => {
  it("joins every issue with its path", () => {
    const schema = z.object({ title: z.string(), due: dateInput(NOW) });
    const result = schema.safeParse({ due: "soon" });
    expect(result.success).toBe(false);
    expect(issuesToString(result.error!)).toBe("title: Required; due: must be YYYY-MM-DD, today or tomorrow");
  });

  it("names a root issue input", () => {
    const result = z.object({}).safeParse("x");
    expect(issuesToString(result.error!)).toMatch(/^input: /);
  });
});

describe("readJsonBody", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request("http://test/api/agent/run", { method: "POST", body, headers });

  it("parses JSON", async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ ok: true, data: { a: 1 } });
  });

  it("reads an empty body as undefined", async () => {
    expect(await readJsonBody(post(""))).toEqual({ ok: true, data: undefined });
  });

  it("rejects invalid JSON with 400", async () => {
    expect(await readJsonBody(post("{"))).toEqual({ ok: false, status: 400, error: "Invalid JSON" });
  });

  it("rejects a body over the cap with 413, whatever Content-Length says", async () => {
    const big = JSON.stringify({ note: "x".repeat(70 * 1024) });
    expect(await readJsonBody(post(big))).toMatchObject({ ok: false, status: 413 });
    expect(await readJsonBody(post("{}", { "content-length": String(1024 * 1024) }))).toMatchObject({ status: 413 });
    expect(await readJsonBody(post('{"a":"12345"}'), 8)).toMatchObject({ status: 413 });
  });
});
