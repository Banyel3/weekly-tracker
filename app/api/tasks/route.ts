import { parseBody } from "@/lib/http";
import { createTask, createTaskSchema } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseBody(request, createTaskSchema);
  if (!parsed.ok) return parsed.response;
  return Response.json(await createTask(parsed.data), { status: 201 });
}
