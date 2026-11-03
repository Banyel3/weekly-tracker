"use client";

import { Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = { id: string; value: string; onChange: (value: string) => void; className?: string };

export function SearchField({ id, value, onChange, className }: Props) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search tasks
      </label>
      <Icon
        icon={Search}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        placeholder="Search tasks"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-[220px] rounded-lg bg-background pl-8 text-sm text-foreground max-[599px]:w-full pointer-coarse:h-11"
      />
    </div>
  );
}
