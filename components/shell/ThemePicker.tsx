"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="self-start px-2 text-xs font-normal text-muted-foreground hover:text-sidebar-foreground pointer-coarse:h-11"
        >
          <Icon icon={Palette} />
          Theme · {current.name}
          <Icon icon={ChevronDown} size="sm" />
        </Button>
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
                {selected && <Icon icon={Check} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
