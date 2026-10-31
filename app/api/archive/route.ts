import { archiveQuerySchema, listArchive } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = Object.fromEntries(
    [...new URL(request.url).searchParams].filter(([, value]) => value !== ""),
  );
  const parsed = archiveQuerySchema.safeParse(params);
  if (!parsed.success) {
    const error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json({ error }, { status: 400 });
  }
  return Response.json(await listArchive(parsed.data));
}
