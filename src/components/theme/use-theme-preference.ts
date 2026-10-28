"use client";

import { useCallback, useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, isThemePreference, type ThemePreference } from "@/lib/theme";

export const THEME_CHANGE_EVENT = "tutelliv-theme-change";

/** Lecture directe de la préférence mémorisée (jamais le snapshot serveur). */
export function readThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function subscribeThemePreference(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Lecture et écriture de la préférence seulement. L'attribut `data-theme` n'est jamais écrit ici :
 * ThemeSync en est l'unique propriétaire.
 */
export function useThemePreference() {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribeThemePreference,
    readThemePreference,
    () => "system"
  );

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour la session seulement */
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { preference, setPreference };
}
