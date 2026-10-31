import { getHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getHealth());
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
