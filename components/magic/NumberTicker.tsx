// adapted from https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/number-ticker.tsx
"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  delay?: number;
}

const format = (n: number) => Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));

export function NumberTicker({ value, startValue = 0, delay = 0, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (reduced) {
      motionValue.jump(value);
      springValue.jump(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    if (!isInView) return;
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, springValue, isInView, delay, value, reduced]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      }),
    [springValue],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)} {...props}>
      {format(reduced ? value : startValue)}
    </span>
  );
}
