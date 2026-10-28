"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { applyThemeToRoot } from "@/lib/theme";

import { readThemePreference, subscribeThemePreference } from "./use-theme-preference";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Pas de layout effect côté serveur (avertissement React) ; sur le client il s'exécute avant la peinture.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Unique propriétaire de `data-theme` sur <html>. Applique le thème de façon synchrone (avant peinture)
 * à chaque changement de route, de préférence ou de thème du système, en lisant la préférence mémorisée
 * (jamais le snapshot serveur) pour ne pas écraser la valeur posée par le script d'initialisation.
 */
export function ThemeSync() {
  const pathname = usePathname() ?? "";

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () =>
      applyThemeToRoot(document.documentElement, pathname, readThemePreference(), media.matches);
    apply();
    const unsubscribe = subscribeThemePreference(apply);
    media.addEventListener("change", apply);
    return () => {
      unsubscribe();
      media.removeEventListener("change", apply);
    };
  }, [pathname]);

  return null;
}
