/** Count only on a change after the first render; the first render shows the final value. */
export function shouldTick(previous: number | null, next: number): boolean {
  return previous !== null && previous !== next;
}
