"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/themes";

export { DEFAULT_THEME, THEMES, THEME_PREVIEWS, type ThemeId } from "@/lib/themes";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (isThemeId(current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setThemeState(next);
  }, []);

  return { theme, setTheme, themes: THEMES };
}
