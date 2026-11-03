import { colorVar } from "../ColorSwatches";

export function ProjectDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colorVar(color) }} />;
}
