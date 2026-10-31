import { prisma } from "./db";

export async function getState(key: string): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({ where: { key }, create: { key, value }, update: { value } });
}
