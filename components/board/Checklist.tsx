"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, type ChecklistItem } from "@/lib/checklist";
import { localId } from "@/lib/localId";
import { cn } from "@/lib/utils";

type Props = { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void; disabled?: boolean };

const blank = (): ChecklistItem => ({ id: localId(), text: "", done: false });

export function Checklist({ items, onChange, disabled }: Props) {
  const legend = useId();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const full = items.length >= CHECKLIST_MAX_ITEMS;
  const done = items.filter((i) => i.done && i.text.trim()).length;
  const total = items.filter((i) => i.text.trim()).length;

  useEffect(() => {
    if (!focusId) return;
    inputs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, items]);

  const patch = (id: string, next: Partial<ChecklistItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...next } : i)));

  function insertAfter(index: number, added: ChecklistItem[]) {
    const room = CHECKLIST_MAX_ITEMS - items.length;
    const kept = added.slice(0, Math.max(0, room));
    if (kept.length === 0) return;
    onChange([...items.slice(0, index + 1), ...kept, ...items.slice(index + 1)]);
    setFocusId(kept[kept.length - 1].id);
  }

  function remove(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    const neighbour = next[Math.max(0, index - 1)];
    if (neighbour) setFocusId(neighbour.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      insertAfter(index, [blank()]);
    } else if (e.key === "Backspace" && items[index].text === "" && items.length > 0) {
      e.preventDefault();
      remove(index);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>, index: number) {
    if (items[index].text !== "") return;
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((l) => l.trim().slice(0, CHECKLIST_TEXT_MAX))
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const [first, ...rest] = lines;
    const room = CHECKLIST_MAX_ITEMS - items.length;
    const added = rest.slice(0, room).map((text) => ({ ...blank(), text }));
    const withFirst = items.map((i, n) => (n === index ? { ...i, text: first } : i));
    onChange([...withFirst.slice(0, index + 1), ...added, ...withFirst.slice(index + 1)]);
    setFocusId((added[added.length - 1] ?? withFirst[index]).id);
  }

  return (
    <div role="group" aria-labelledby={legend} className="flex flex-col gap-1.5">
      <span id={legend} className="flex items-baseline gap-2 text-xs font-medium text-muted-foreground">
        Checklist
        {total > 0 && (
          <span className="font-normal tabular-nums">
            {done}/{total}
          </span>
        )}
      </span>
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <Checkbox
                checked={item.done}
                disabled={disabled}
                aria-label={`done: ${item.text || `item ${index + 1}`}`}
                onCheckedChange={(v) => patch(item.id, { done: v === true })}
                className="pointer-coarse:size-6"
              />
              <Input
                ref={(el) => {
                  if (el) inputs.current.set(item.id, el);
                  else inputs.current.delete(item.id);
                }}
                aria-label={`item ${index + 1}`}
                value={item.text}
                maxLength={CHECKLIST_TEXT_MAX}
                disabled={disabled}
                onChange={(e) => patch(item.id, { text: e.target.value })}
                onKeyDown={(e) => onKeyDown(e, index)}
                onPaste={(e) => onPaste(e, index)}
                className={cn(
                  "h-8 flex-1 border-transparent bg-transparent px-2 shadow-none hover:border-input dark:bg-transparent pointer-coarse:h-11",
                  item.done && "text-muted-foreground line-through",
                )}
              />
              <Hint label="Remove item">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="remove item"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  className="size-7 text-muted-foreground hover:text-foreground pointer-coarse:size-11"
                >
                  <Icon icon={X} size="sm" />
                </Button>
              </Hint>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || full}
        onClick={() => insertAfter(items.length - 1, [blank()])}
        className="-ml-2.5 self-start text-muted-foreground hover:text-foreground pointer-coarse:h-11"
      >
        <Icon icon={Plus} size="sm" />
        Add item
      </Button>
    </div>
  );
}
