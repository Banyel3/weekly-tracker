"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { THEME_PREVIEWS, useTheme } from "@/components/useTheme";
import { cn } from "@/lib/utils";

function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  items[(at + step + items.length) % items.length]?.focus();
}

export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const current = themes.find((t) => t.id === theme) ?? themes[0];
  const [primary, , , warm] = THEME_PREVIEWS[current.id];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex min-h-8 items-center whitespace-nowrap gap-2 self-start rounded-md px-2 py-1.5 text-xs text-muted-foreground outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={{ background: `linear-gradient(135deg, ${primary}, ${warm})` }}
        />
        Theme · {current.name}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-60 p-1">
        <div role="radiogroup" aria-label="Theme" className="flex flex-col" onKeyDown={moveFocus}>
          {themes.map((t) => {
            const selected = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
                <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-sm border border-border">
                  {THEME_PREVIEWS[t.id].map((color, i) => (
                    <span key={i} className="block size-4" style={{ background: color }} />
                  ))}
                </span>
                <span className="flex-1">{t.name}</span>
                {selected && <Check aria-hidden="true" className="size-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
