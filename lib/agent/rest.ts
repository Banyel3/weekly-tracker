import { requireAgent } from "./auth";
import { runTool, toolResponse } from "./ops";
import { readJsonBody } from "./parse";

type Body = { ok: true; data: Record<string, unknown> } | { ok: false; response: Response };

const error = (status: number, message: string) => Response.json({ error: message }, { status });

/** A capped JSON object body for the REST routes; an empty body reads as {}. */
export async function objectBody(request: Request): Promise<Body> {
  const body = await readJsonBody(request);
  if (!body.ok) return { ok: false, response: error(body.status, body.error) };
  if (body.data === undefined) return { ok: true, data: {} };
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
    return { ok: false, response: error(400, "body must be a JSON object") };
  }
  return { ok: true, data: body.data as Record<string, unknown> };
}

/** Auth, then the tool, answered without the /run envelope: the bare result or `{ error }`. */
export async function restTool(
  request: Request,
  name: string,
  input: (() => Promise<Record<string, unknown> | Response>) | Record<string, unknown> = {},
): Promise<Response> {
  const denied = requireAgent(request);
  if (denied) return denied;
  const resolved = typeof input === "function" ? await input() : input;
  if (resolved instanceof Response) return resolved;
  return toolResponse(await runTool(name, resolved), { envelope: false });
}

/** Body fields plus the path id; the path id wins over an id in the body. */
export const bodyWithId = (request: Request, id: string) => async () => {
  const body = await objectBody(request);
  return body.ok ? { ...body.data, id } : body.response;
};

export const notFound = (message: string) => error(404, message);

const STRING_PARAMS = ["status", "project", "due_from", "due_to", "query"] as const;

/** Query params mirror list_tasks; booleans and numbers that do not parse pass through so zod names the bad one. */
export function listInput(params: URLSearchParams): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const key of STRING_PARAMS) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  const archived = params.get("archived");
  if (archived !== null) input.archived = archived === "true" ? true : archived === "false" ? false : archived;
  const limit = params.get("limit");
  if (limit !== null) input.limit = /^\d+$/.test(limit) ? Number(limit) : limit;
  return input;
}
