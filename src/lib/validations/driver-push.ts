import { z } from "zod";

/**
 * Services de notification des navigateurs. Le serveur appelle cette adresse fournie par le client :
 * la liste fermée l'empêche de viser autre chose (réseau interne, site tiers).
 */
const PUSH_HOST = /^(?:fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;

export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && PUSH_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

const endpoint = z.string().max(2048).refine(isAllowedPushEndpoint, "Service de notification non reconnu");
const key = z.string().min(1).max(256).regex(/^[A-Za-z0-9_=-]+$/, "Clé d'abonnement invalide");

export const driverPushSubscriptionSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: key, auth: key }),
});

export const driverPushUnsubscribeSchema = z.object({ endpoint });
