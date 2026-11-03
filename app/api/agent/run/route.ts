import { z } from "zod";
import { requireAgent } from "@/lib/agent/auth";
import { runTool, toolResponse } from "@/lib/agent/ops";
import { issuesToString, readJsonBody } from "@/lib/agent/parse";

export const dynamic = "force-dynamic";

const runSchema = z.object({
  name: z.string().min(1),
  input: z.record(z.unknown()).optional(),
});

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const denied = requireAgent(request);
  if (denied) return fail(denied.status, ((await denied.json()) as { error: string }).error);
  const body = await readJsonBody(request);
  if (!body.ok) return fail(body.status, body.error);
  const parsed = runSchema.safeParse(body.data);
  if (!parsed.success) return fail(400, issuesToString(parsed.error));
  return toolResponse(await runTool(parsed.data.name, parsed.data.input ?? {}));
}
