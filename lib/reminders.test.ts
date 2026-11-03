import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    appState: { findUnique: vi.fn(async () => null), upsert: vi.fn() },
    task: {
      findMany: vi.fn(async () => [
        {
          id: "t1",
          title: "Pay rent",
          dueDate: new Date("2026-10-31T00:00:00.000Z"),
          status: "THIS_WEEK",
          priority: "NONE",
          weekOf: new Date("2026-10-26T00:00:00.000Z"),
          createdAt: new Date("2026-10-26T01:00:00.000Z"),
          project: { name: "Home" },
        },
      ]),
    },
    taskEvent: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("./db", () => ({ prisma }));

import { catchUpMissedJobs } from "./catchUp";
import { sendTelegram } from "./reminders";

const abort = () => Object.assign(new Error("The operation was aborted"), { name: "AbortError" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendTelegram timeout", () => {
  it("passes an abort signal and logs a timeout instead of throwing", async () => {
    const fetch = vi.fn().mockRejectedValue(abort());
    vi.stubGlobal("fetch", fetch);
    expect(await sendTelegram("hi", "reminders")).toBe(false);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/timed out/));
  });

  it("lets catch-up finish without writing the marker when the send times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort()));
    await expect(catchUpMissedJobs(new Date(Date.UTC(2026, 9, 31, 2, 0)))).resolves.toBeUndefined();
    expect(prisma.appState.upsert).not.toHaveBeenCalled();
  });

  it("sends the morning digest on catch-up and then writes the marker", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    // Sat 2026-10-31 10:00 Manila.
    await catchUpMissedJobs(new Date(Date.UTC(2026, 9, 31, 2, 0)));
    const { text } = JSON.parse(fetch.mock.calls[0][1].body);
    expect(text).toContain("Good morning · Sat Oct 31 · day 6 of 7");
    expect(text).toContain("Due today\n• Pay rent · Home");
    expect(prisma.appState.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { key: "lastSentOn:reminder", value: "2026-10-31" } }));
  });
});
