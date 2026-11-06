"use client";

import { useEffect } from "react";
import { sendFunnelEvent } from "@/features/landing/funnel-beacon";
import { onHumanPresence } from "@/features/landing/human-presence";

const MAIL_LINKS = { rejoindre: "mail_join", site: "mail_site" } as const;

/**
 * Clic sur un lien d'un mail de campagne (`/go/<code>/<lien>` redirige ici avec `?c=<code>&m=<lien>`).
 * Compté une fois par arrivée, et seulement après un geste réel : les antivirus des messageries qui
 * ouvrent le lien sans rien faire ne comptent plus. `m` est retiré de l'adresse ; `c` reste pour l'inscription.
 */
export function MailLinkBeacon() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("c")?.slice(0, 100);
    const link = url.searchParams.get("m");
    if (!link) return;
    url.searchParams.delete("m");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!code || !(link in MAIL_LINKS)) return;
    const event = MAIL_LINKS[link as keyof typeof MAIL_LINKS];
    // Rien n'est stocké dans le navigateur : retirer `m` de l'adresse suffit à ne pas recompter au rechargement.
    return onHumanPresence(() => sendFunnelEvent(event, code));
  }, []);
  return null;
}
