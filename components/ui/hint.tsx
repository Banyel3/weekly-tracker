"use client";

import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  label: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  children: ReactElement;
};

/** Tooltip for an icon-only control; the control keeps its own aria-label. */
export function Hint({ label, side, children }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
