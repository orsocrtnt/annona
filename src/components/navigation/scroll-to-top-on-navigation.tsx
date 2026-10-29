"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { shouldResetScrollOnNavigation } from "@/lib/navigation/scroll-policy";

/**
 * Le défilement des quatre espaces (site public, back-office, portail client, application livreur)
 * est celui du document : `document.scrollingElement`. Next conserve la position quand le haut de la
 * nouvelle page est déjà visible, ce qui laisse le bas de la page suivante après un clic de menu.
 * On remonte donc explicitement, seulement quand le chemin change et que ce n'est ni un Retour/Avancer
 * ni une ancre (voir `shouldResetScrollOnNavigation`).
 */
export function ScrollToTopOnNavigation() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const historyPathname = useRef<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      historyPathname.current = window.location.pathname;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const reset = shouldResetScrollOnNavigation({
      previousPathname: previous.current,
      pathname,
      hash: window.location.hash,
      historyPathname: historyPathname.current,
    });
    previous.current = pathname;
    historyPathname.current = null;
    if (!reset) return;
    // « instant » : `scroll-smooth` est posé sur <html>, un défilement animé serait vu comme un glissement.
    (document.scrollingElement ?? document.documentElement).scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
