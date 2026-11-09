import { Priority, Status } from "@prisma/client";
import { z, type ZodError } from "zod";
import { dateToYmd, shiftYmd, todayYmd, ymdToDate } from "../week";

/** Agent-facing names: lower snake case, matched case-insensitively ("In Progress" and "in-progress" work too). */
export const STATUS_NAMES = ["backlog", "future", "this_week", "in_progress", "done"] as const;
export const PRIORITY_NAMES = ["none", "high", "urgent"] as const;

const STATUS_BY_NAME: Record<(typeof STATUS_NAMES)[number], Status> = {
  backlog: Status.BACKLOG,
  future: Status.FUTURE,
  this_week: Status.THIS_WEEK,
  in_progress: Status.IN_PROGRESS,
  done: Status.DONE,
};

const PRIORITY_BY_NAME: Record<(typeof PRIORITY_NAMES)[number], Priority> = {
  none: Priority.NONE,
  high: Priority.HIGH,
  urgent: Priority.URGENT,
};

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

function enumInput<T>(names: readonly string[], byName: Record<string, T>, label: string) {
  return z.string().transform((value, ctx) => {
    const mapped = byName[normalizeName(value)];
    if (mapped === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be one of ${names.join(", ")}` });
      return z.NEVER;
    }
    return mapped;
  });
}

export const statusInput = enumInput(STATUS_NAMES, STATUS_BY_NAME, "status");
export const priorityInput = enumInput(PRIORITY_NAMES, PRIORITY_BY_NAME, "priority");

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day: 2026-02-30 fails the round trip. */
export function isYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const date = ymdToDate(value);
  return !Number.isNaN(date.getTime()) && dateToYmd(date) === value;
}

/** `YYYY-MM-DD`, `today` or `tomorrow` (Asia/Manila) → `YYYY-MM-DD`. Built per call so the sugar follows `now`. */
export function dateInput(now: Date) {
  return z.string().transform((value, ctx) => {
    const v = value.trim().toLowerCase();
    if (v === "today") return todayYmd(now);
    if (v === "tomorrow") return shiftYmd(todayYmd(now), 1);
    if (isYmd(v)) return v;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be YYYY-MM-DD, today or tomorrow" });
    return z.NEVER;
  });
}

/** `title: Required; due: must be YYYY-MM-DD, today or tomorrow` */
export function issuesToString(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}

export const AGENT_BODY_LIMIT = 64 * 1024;

export type BodyResult = { ok: true; data: unknown } | { ok: false; status: 400 | 413; error: string };

/** Reads a JSON body capped at `limit` bytes; an empty body reads as undefined so callers can default it. */
export async function readJsonBody(request: Request, limit: number = AGENT_BODY_LIMIT): Promise<BodyResult> {
  const tooLarge = { ok: false, status: 413, error: `body over ${limit} bytes` } as const;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return tooLarge;
  const bytes = await readCapped(request, limit);
  if (bytes === null) return tooLarge;
  const text = new TextDecoder().decode(bytes);
  if (text.trim() === "") return { ok: true, data: undefined };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}

/** Stops reading as soon as the stream passes the cap, whatever Content-Length claimed. */
async function readCapped(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
