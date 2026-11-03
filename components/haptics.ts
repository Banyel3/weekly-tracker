export function haptic(ms = 10) {
  if (typeof navigator === "undefined") return;
  navigator.vibrate?.(ms);
}
