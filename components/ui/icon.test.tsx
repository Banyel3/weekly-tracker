import { Plus } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon } from "./icon";

const render = (props: Partial<Parameters<typeof Icon>[0]> = {}) =>
  renderToStaticMarkup(createElement(Icon, { icon: Plus, ...props }));

describe("Icon", () => {
  it.each([
    ["sm", 14],
    ["md", 16],
    ["lg", 20],
  ] as const)("renders %s at %ipx with a 1.75 absolute stroke", (size, px) => {
    const html = render({ size });
    expect(html).toContain(`width="${px}"`);
    expect(html).toContain(`height="${px}"`);
    expect(html).toContain(`stroke-width="${(1.75 * 24) / px}"`);
  });

  it("defaults to md", () => {
    expect(render()).toContain('width="16"');
  });

  it("is hidden from assistive tech by default", () => {
    const html = render();
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
    expect(html).toContain("shrink-0");
  });

  it("is labelled when given a label", () => {
    const html = render({ label: "Urgent" });
    expect(html).toContain('aria-label="Urgent"');
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-hidden");
  });
});
