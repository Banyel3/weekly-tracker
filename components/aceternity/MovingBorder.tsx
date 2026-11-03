// adapted from https://ui.aceternity.com/components/moving-border
"use client";

import React, { useRef, type ReactNode } from "react";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

type FrameProps = {
  children: ReactNode;
  className?: string;
  borderClassName?: string;
  borderRadius?: string;
  duration?: number;
  active?: boolean;
};

export function MovingBorderFrame({
  children,
  className,
  borderClassName,
  borderRadius = "0.75rem",
  duration = 4000,
  active = true,
}: FrameProps) {
  return (
    // clip-path clips the travelling glow to the card's rounded rect even while an ancestor is transformed
    // (overflow + border-radius alone lets it bleed past the corners in WebKit).
    <div
      className="relative isolate h-full overflow-hidden"
      style={{ borderRadius, clipPath: active ? `inset(0 round ${borderRadius})` : undefined }}
    >
      {active && (
        <div aria-hidden="true" className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
          <MovingBorder duration={duration} rx="12" ry="12">
            <div
              className={cn(
                "size-20 bg-[radial-gradient(var(--alert)_40%,transparent_60%)] opacity-80",
                borderClassName,
              )}
            />
          </MovingBorder>
        </div>
      )}
      <div
        className={cn("relative h-full", active && className)}
        style={{ borderRadius }}
      >
        {children}
      </div>
    </div>
  );
}

type BorderProps = {
  children: ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
};

export function MovingBorder({ children, duration = 3000, rx, ry }: BorderProps) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) progress.set((time * (length / duration)) % length);
  });

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).x ?? 0);
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }}>
        {children}
      </motion.div>
    </>
  );
}
