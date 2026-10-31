import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PREVIEW_VARS, THEMES, THEME_PREVIEWS, isThemeId } from "./themes";

function cssVar(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("themes", () => {
  it.each(THEMES.map((t) => t.id))("preview for %s matches its preset file", (id) => {
    const css = readFileSync(join(__dirname, "..", "themes", `${id}.css`), "utf8");
    expect(css).toContain(`:root[data-theme="${id}"]`);
    expect(THEME_PREVIEWS[id]).toEqual(PREVIEW_VARS.map((name) => cssVar(css, name)));
  });

  it("recognises only shipped ids", () => {
    expect(isThemeId("graphite")).toBe(true);
    expect(isThemeId("light")).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});
