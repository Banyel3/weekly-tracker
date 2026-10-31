export const THEMES = [
  { id: "cosmic-night", name: "Cosmic Night" },
  { id: "mocha-mousse", name: "Mocha Mousse" },
  { id: "catppuccin", name: "Catppuccin" },
  { id: "graphite", name: "Graphite" },
  { id: "northern-lights", name: "Northern Lights" },
  { id: "amethyst-haze", name: "Amethyst Haze" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

export const DEFAULT_THEME: ThemeId = "cosmic-night";

export const THEME_STORAGE_KEY = "theme";

export const PREVIEW_VARS = ["--primary", "--card", "--chart-3", "--chart-5"] as const;

/** Copied from themes/<id>.css so the picker can preview a preset without applying it; a test keeps them in sync. */
export const THEME_PREVIEWS: Record<ThemeId, readonly [string, string, string, string]> = {
  "cosmic-night": [
    "oklch(0.7162 0.1597 290.3962)",
    "oklch(0.2284 0.0384 282.9324)",
    "oklch(0.7482 0.1235 244.7492)",
    "oklch(0.7546 0.1831 346.8124)",
  ],
  "mocha-mousse": [
    "oklch(0.7272 0.0539 52.3320)",
    "oklch(0.3291 0.0156 50.8936)",
    "oklch(0.6083 0.0623 44.3588)",
    "oklch(0.6440 0.0405 52.3917)",
  ],
  catppuccin: [
    "oklch(0.7871 0.1187 304.7693)",
    "oklch(0.2429 0.0304 283.9110)",
    "oklch(0.8577 0.1092 142.7153)",
    "oklch(0.9226 0.0238 30.4919)",
  ],
  graphite: ["oklch(0.7058 0 0)", "oklch(0.2435 0 0)", "oklch(0.5452 0 0)", "oklch(0.3715 0 0)"],
  "northern-lights": [
    "oklch(0.6487 0.1538 150.3071)",
    "oklch(0.3210 0.0078 223.6661)",
    "oklch(0.6746 0.1414 261.3380)",
    "oklch(0.5905 0.1608 148.2409)",
  ],
  "amethyst-haze": [
    "oklch(0.7058 0.0777 302.0489)",
    "oklch(0.2544 0.0301 292.7315)",
    "oklch(0.7321 0.0749 169.8670)",
    "oklch(0.7857 0.0645 258.0839)",
  ],
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}
