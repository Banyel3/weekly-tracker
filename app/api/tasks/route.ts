import { isPrismaError, parseBody, unknownProject } from "@/lib/http";
import { createTask, createTaskSchema } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseBody(request, createTaskSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return Response.json(await createTask(parsed.data), { status: 201 });
  } catch (e) {
    if (isPrismaError(e, "P2003")) return unknownProject();
    throw e;
  }
}
