import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { px: 14, cls: "size-3.5" },
  md: { px: 16, cls: "size-4" },
  lg: { px: 20, cls: "size-5" },
} as const;

type Props = {
  icon: LucideIcon;
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
};

export function Icon({ icon: Glyph, size = "md", className, label }: Props) {
  const { px, cls } = SIZES[size];
  const a11y = label ? { "aria-label": label, role: "img" } : { "aria-hidden": true };
  return (
    <Glyph
      size={px}
      strokeWidth={1.75}
      absoluteStrokeWidth
      className={cn("shrink-0", cls, className)}
      {...a11y}
    />
  );
}
