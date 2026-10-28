"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import {
  THEME_STORAGE_KEY,
  isThemePreference,
  isThemeScopedPath,
  type ThemePreference,
} from "@/lib/theme";

const CHANGE_EVENT = "tutelliv-theme-change";

function readPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Préférence mémorisée + synchronisation de `data-theme` sur <html> pour les espaces migrés. */
export function useThemePreference() {
  const pathname = usePathname();
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readPreference, () => "system");
  const scoped = isThemeScopedPath(pathname ?? "");

  useEffect(() => {
    const root = document.documentElement;
    if (scoped) root.setAttribute("data-theme", preference);
    else root.removeAttribute("data-theme");
  }, [preference, scoped]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour la session seulement */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { preference, setPreference };
}
