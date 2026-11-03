// Tremor ProgressCircle [v0.0.3]

import React from "react";
import { cn } from "@/lib/utils";

interface ProgressCircleProps extends Omit<React.SVGProps<SVGSVGElement>, "value"> {
  value?: number;
  max?: number;
  showAnimation?: boolean;
  radius?: number;
  strokeWidth?: number;
  label?: string;
  children?: React.ReactNode;
}

const ProgressCircle = React.forwardRef<SVGSVGElement, ProgressCircleProps>(
  (
    {
      value = 0,
      max = 100,
      radius = 28,
      strokeWidth = 6,
      showAnimation = true,
      label = "Progress",
      className,
      children,
      ...props
    }: ProgressCircleProps,
    forwardedRef,
  ) => {
    const safeValue = Math.min(max, Math.max(value, 0));
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const offset = circumference - (max > 0 ? safeValue / max : 0) * circumference;

    return (
      <div
        className="relative shrink-0"
        role="progressbar"
        aria-label={label}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={max}
        data-max={max}
        data-value={safeValue}
        tremor-id="tremor-raw"
      >
        <svg
          ref={forwardedRef}
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          aria-hidden="true"
          className={cn("-rotate-90 transform", className)}
          {...props}
        >
          <circle
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            style={{ stroke: "var(--border)" }}
          />
          {safeValue > 0 ? (
            <circle
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              fill="transparent"
              strokeLinecap="round"
              style={{ stroke: "var(--primary)" }}
              className={cn(
                showAnimation && "transition-[stroke-dashoffset] duration-150 ease-out motion-reduce:transition-none",
              )}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      </div>
    );
  },
);

ProgressCircle.displayName = "ProgressCircle";

export { ProgressCircle, type ProgressCircleProps };
