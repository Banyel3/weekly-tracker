import type { z, ZodTypeAny } from "zod";

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return { ok: false, response: Response.json({ error }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}
