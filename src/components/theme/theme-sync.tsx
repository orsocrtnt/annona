"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { PHONE_MEDIA_QUERY, applyThemeToRoot } from "@/lib/theme";

import { readThemePreference, subscribeThemePreference } from "./use-theme-preference";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Pas de layout effect côté serveur (avertissement React) ; sur le client il s'exécute avant la peinture.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Propriétaire de `data-theme` sur <html> après hydratation (THEME_INIT_SCRIPT le pose au premier
 * chargement, avec la même règle resolveRootTheme). Applique le thème de façon synchrone (avant peinture)
 * à chaque changement de route, de préférence ou de thème du système, en lisant la préférence mémorisée
 * (jamais le snapshot serveur) pour ne pas écraser la valeur posée par le script d'initialisation.
 */
export function ThemeSync() {
  const pathname = usePathname() ?? "";

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const phone = window.matchMedia(PHONE_MEDIA_QUERY);
    const apply = () => {
      applyThemeToRoot(document.documentElement, pathname, readThemePreference(), media.matches, phone.matches);
      // Zone de l'heure et de la batterie sur iPhone : même couleur que le fond de la page.
      const pageColor = getComputedStyle(document.body).backgroundColor;
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", pageColor));
    };
    apply();
    const unsubscribe = subscribeThemePreference(apply);
    media.addEventListener("change", apply);
    phone.addEventListener("change", apply);
    return () => {
      unsubscribe();
      media.removeEventListener("change", apply);
      phone.removeEventListener("change", apply);
    };
  }, [pathname]);

  return null;
}
