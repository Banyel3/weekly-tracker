// adapted from https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/number-ticker.tsx
"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { animate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { TRANSITION, useReducedMotion } from "../motion/config";
import { shouldTick } from "./ticker";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
}

const format = (n: number) => Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

/** Renders the final value at once; counts (150ms) only when the value changes after that. */
export function NumberTicker({ value, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const shown = useMotionValue(value);
  const previous = useRef<number | null>(null);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = value;
    const tick = shouldTick(from, value) && !reduced;
    if (!tick) shown.jump(value);
    if (ref.current) ref.current.textContent = format(shown.get());
    if (!tick) return;
    const controls = animate(shown, value, TRANSITION);
    return () => controls.stop();
  }, [shown, value, reduced]);

  useEffect(
    () =>
      shown.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [shown],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>
      {format(value)}
    </span>
  );
}
