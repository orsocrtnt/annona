"use client";

import { useEffect, useLayoutEffect } from "react";

import { ClientPortalLayout } from "@/components/layouts/client-portal-layout";
import { PortalGuard } from "@/features/client-portal/portal-guard";
import { sora } from "./portal-font";

// Pas de layout effect côté serveur ; sur le client il s'exécute avant la peinture.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Sora (titres DESIGN.md) dans le portail. Les dialogues, tiroirs et menus Radix sont rendus dans <body>,
 * hors de cette div : la variable de police et l'attribut `data-portal` sont donc aussi posés sur <html>
 * tant que le portail est monté (retirés avant peinture en quittant le portail). La div garde la variable
 * pour le premier rendu serveur, avant hydratation. Règle de police : globals.css.
 */
export default function ClientPortalRootLayout({ children }: { children: React.ReactNode }) {
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(sora.variable);
    root.setAttribute("data-portal", "");
    return () => {
      root.classList.remove(sora.variable);
      root.removeAttribute("data-portal");
    };
  }, []);

  return (
    <div className={sora.variable} data-portal-root>
      <ClientPortalLayout>
        <PortalGuard>{children}</PortalGuard>
      </ClientPortalLayout>
    </div>
  );
}
