import { requireAgent } from "@/lib/agent/auth";
import { AGENT_TOOLS } from "@/lib/agent/ops";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAgent(request);
  if (denied) return denied;
  return Response.json({ tools: AGENT_TOOLS });
}
