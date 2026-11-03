import { createHash, timingSafeEqual } from "node:crypto";

export const AGENT_DISABLED = "agent api disabled: set AGENT_API_TOKEN";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Hashing first gives equal-length buffers, so neither the content nor the length of the token leaks through timing. */
function tokensMatch(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/** null when the request carries the right bearer token; otherwise the 503 or 401 response to return. */
export function requireAgent(request: Request): Response | null {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected) return Response.json({ error: AGENT_DISABLED }, { status: 503 });
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") ?? "");
  if (!match || !tokensMatch(match[1], expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
