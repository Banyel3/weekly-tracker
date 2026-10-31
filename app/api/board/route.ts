import { listBoard } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listBoard());
}
