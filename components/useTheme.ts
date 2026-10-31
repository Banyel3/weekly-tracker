"use client";

import { useCallback, useEffect, useState } from "react";

export const THEMES = [
  { id: "cosmic-night", name: "Cosmic Night" },
  { id: "mocha-mousse", name: "Mocha Mousse" },
  { id: "catppuccin", name: "Catppuccin" },
  { id: "graphite", name: "Graphite" },
  { id: "northern-lights", name: "Northern Lights" },
  { id: "amethyst-haze", name: "Amethyst Haze" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "cosmic-night";

const STORAGE_KEY = "theme";

function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (isThemeId(current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setThemeState(next);
  }, []);

  return { theme, setTheme, themes: THEMES };
}
