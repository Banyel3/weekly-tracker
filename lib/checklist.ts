import { z } from "zod";

export const CHECKLIST_MAX_ITEMS = 20;
export const CHECKLIST_TEXT_MAX = 120;

export const checklistItemSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().trim().max(CHECKLIST_TEXT_MAX),
  done: z.boolean().default(false),
});

export const checklistSchema = z.array(checklistItemSchema).max(CHECKLIST_MAX_ITEMS);

export type ChecklistItem = { id: string; text: string; done: boolean };

export function normalizeChecklist(items: z.infer<typeof checklistSchema>): ChecklistItem[] {
  return items
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text.length > 0)
    .slice(0, CHECKLIST_MAX_ITEMS)
    .map((item) => ({ id: item.id ?? crypto.randomUUID(), text: item.text, done: item.done }));
}

export function readChecklist(value: unknown): ChecklistItem[] {
  const parsed = z
    .array(z.object({ id: z.string(), text: z.string(), done: z.boolean() }))
    .safeParse(value);
  return parsed.success ? parsed.data : [];
}
