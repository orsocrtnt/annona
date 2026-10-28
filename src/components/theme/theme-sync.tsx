"use client";

import { useThemePreference } from "./use-theme-preference";

/** Garde `data-theme` aligné lors des navigations client entre espaces. À monter une fois dans les providers. */
export function ThemeSync() {
  useThemePreference();
  return null;
}
