import type { Transition } from "motion/react";

export { useReducedMotion } from "motion/react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";
export const DURATION_MS = 150;
export const TRANSITION: Transition = { duration: DURATION_MS / 1000, ease: EASE_OUT };
