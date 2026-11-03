import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("opens standalone at the board with Cosmic Night colours", () => {
    expect(m).toMatchObject({ name: "Weekly Tracker", short_name: "Weekly", display: "standalone", start_url: "/" });
    expect(m.background_color).toBe("#0f0f1a");
    expect(m.theme_color).toBe("#0f0f1a");
  });

  it("lists 192 and 512 icons, a maskable one, and every file exists", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
    for (const icon of icons) expect(existsSync(join(__dirname, "..", "public", icon.src))).toBe(true);
    expect(existsSync(join(__dirname, "..", "public", "icons", "apple-touch-icon.png"))).toBe(true);
  });
});
