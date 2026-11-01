"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = { id: string; value: string; onChange: (value: string) => void; className?: string };

export function SearchField({ id, value, onChange, className }: Props) {
  return (
    <label htmlFor={id} className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <span>Search</span>
      <Input
        id={id}
        type="search"
        placeholder="title or note"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[30px] w-[200px] rounded-lg bg-background px-2.5 text-sm text-foreground max-[599px]:w-full pointer-coarse:h-11"
      />
    </label>
  );
}
