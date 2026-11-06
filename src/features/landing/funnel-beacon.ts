/** ADMIN-ESPACE : envoi anonyme d'un compteur de l'entonnoir (compteur par jour et par campagne, rien d'identifiant). */
export type FunnelBeaconEvent = "visit" | "click" | "mail_join" | "mail_site";

const FUNNEL_URL = "/api/waitlist/funnel";

/** `credentials: "omit"` : aucun cookie n'accompagne l'envoi ; `keepalive` : l'envoi survit à un départ de la page. */
export function sendFunnelEvent(event: FunnelBeaconEvent, campaign: string | undefined) {
  try {
    void fetch(FUNNEL_URL, {
      method: "POST",
      body: JSON.stringify(campaign ? { event, campaign } : { event }),
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Comptage facultatif : jamais d'erreur visible pour le visiteur.
  }
}
