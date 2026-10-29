"use client";

import { useSyncExternalStore } from "react";
import type { MapTheme } from "@/lib/maps/menthe-style";

/** Thème résolu posé sur <html data-theme> par le script de thème ; absent = Clair (espaces non migrés). */
export function readMapTheme(root: Pick<HTMLElement, "getAttribute"> | null | undefined): MapTheme {
  return root?.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Thème de la carte : suit en direct la bascule Clair / Sombre / Système sans recharger la page. */
export function useMapTheme(): MapTheme {
  return useSyncExternalStore(
    subscribe,
    () => readMapTheme(document.documentElement),
    () => "light"
  );
}
