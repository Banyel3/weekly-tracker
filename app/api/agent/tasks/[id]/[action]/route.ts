import { requireAgent } from "@/lib/agent/auth";
import { bodyWithId, notFound, restTool } from "@/lib/agent/rest";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; action: string }> };

/** Column shortcuts for move_task; the body is ignored. */
const MOVES: Record<string, string> = { done: "done", start: "in_progress", plan: "this_week", backlog: "backlog" };

/** Actions whose optional body becomes the tool input (snooze: days / until; restore: status). */
const WITH_BODY: Record<string, string> = { snooze: "snooze_task", restore: "restore_task" };

export async function POST(request: Request, { params }: Context) {
  const { id, action } = await params;
  const move = MOVES[action];
  if (move) return restTool(request, "move_task", { id, status: move });
  const tool = WITH_BODY[action];
  if (tool) return restTool(request, tool, bodyWithId(request, id));
  return requireAgent(request) ?? notFound(`unknown action: ${action}`);
}
