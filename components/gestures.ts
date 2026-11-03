import type { Status } from "./board/dnd";

/** Below this pointer travel a long press counts as "held still". */
export const STILL_PX = 8;
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.5;

/** The bottom sheet closes past 120px of drag, or on a downward flick faster than 0.5px/ms. */
export function shouldDismiss(offset: number, velocity: number): boolean {
  return offset > DISMISS_PX || (offset > 0 && velocity > DISMISS_VELOCITY);
}

type Press = { touch: boolean; delta: { x: number; y: number }; over: Status | undefined; from: Status };

/** A touch long-press that activated the drag but was released in place, over its own column or nothing. */
export function isLongPressWithoutMove({ touch, delta, over, from }: Press): boolean {
  return touch && Math.hypot(delta.x, delta.y) < STILL_PX && (over === undefined || over === from);
}
