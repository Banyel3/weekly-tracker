import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    appState: { findUnique: vi.fn(async () => null), upsert: vi.fn() },
    task: { findMany: vi.fn(async () => [{ title: "Pay rent" }]) },
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
});
