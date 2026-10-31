"use client";

import { useId } from "react";
import type { ProjectColor } from "@/lib/projects";
import { cn } from "@/lib/utils";

/** Mirrors PROJECT_COLORS in lib/projects (not value-imported: that module pulls in Prisma). */
export const COLORS: readonly ProjectColor[] = ["rose", "amber", "lime", "teal", "sky", "violet", "pink", "slate"];

export function colorVar(color: string): string {
  return `var(--project-${color})`;
}

type Props = {
  value: ProjectColor;
  onChange: (color: ProjectColor) => void;
  legend?: string;
  className?: string;
};

export function ColorSwatches({ value, onChange, legend = "Color", className }: Props) {
  const name = useId();
  return (
    <fieldset className={cn("swatches m-0 flex flex-wrap gap-1 border-0 p-0", className)}>
      <legend className="mb-1 p-0 text-xs font-semibold text-muted-foreground">{legend}</legend>
      {COLORS.map((color) => (
        <label
          key={color}
          className="relative m-0 grid size-6 cursor-pointer place-items-center rounded-full border-2 border-transparent transition-colors duration-150 ease-out has-checked:border-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring motion-reduce:transition-none pointer-coarse:size-11"
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            aria-label={color}
            value={color}
            checked={value === color}
            onChange={() => onChange(color)}
          />
          <span className="size-3.5 rounded-full" style={{ background: colorVar(color) }} />
        </label>
      ))}
    </fieldset>
  );
}
