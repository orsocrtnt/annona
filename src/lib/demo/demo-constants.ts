/**
 * DEMO-1 — constantes de la démo publique, sans dépendance serveur (lisibles par la page /demo et le middleware).
 *
 * Une démo par visiteur : un des DEMO_MAX_SLOTS environnements `demopool_NN_…` lui est prêté jusqu'à sa déconnexion,
 * DEMO_LEASE_MS au plus et jamais au-delà de la fin de journée (minuit à Paris). Le prêt est porté
 * par le cookie DEMO_LEASE_COOKIE (jeton aléatoire, seule son empreinte est en base) : sans ce cookie, un compte
 * de démo ne s'ouvre pas, donc un visiteur ne peut pas entrer dans l'environnement d'un autre.
 */
import type { DemoPersona } from "@/domains/demo/demo-scenario";
import { addCalendarDays, parisWallTimeToUtc, zonedTodayDate } from "@/lib/time/paris";

export const DEMO_LEASE_COOKIE = "annona-demo-lease";
/** Code responsable des boutiques de démo (LOT2-D4, prix boutique) : public, affiché sur la page /demo. */
export const DEMO_SHOP_MANAGER_CODE = "1234";
/** Durée maximale d'un prêt : 4 heures (un visiteur parti sans se déconnecter ne garde pas sa démo). */
export const DEMO_LEASE_MS = 4 * 60 * 60 * 1000;
/** Nombre d'environnements de démo, donc de visiteurs simultanés (demande d'Orso du 23 novembre 2026 : 6). */
export const DEMO_MAX_SLOTS = 6;
/** Une réserve préparée depuis moins longtemps est prêtée telle quelle (la journée reste à l'heure, à 30 min près). */
export const DEMO_FRESH_MS = 30 * 60 * 1000;
/** Un environnement resté « en préparation » plus longtemps est considéré comme abandonné (échec, coupure). */
export const DEMO_PREPARING_STALE_MS = 10 * 60 * 1000;

const MIDNIGHT = { hour: 0, minute: 0 };

/**
 * Fin d'un prêt commencé à `now` : DEMO_LEASE_MS plus tard, mais jamais après la fin de journée (minuit à Paris).
 * Chaque soir, toutes les démos sont donc rendues, et reconstruites avant d'être prêtées de nouveau.
 */
export function demoLeaseExpiry(now: Date): Date {
  const endOfDay = parisWallTimeToUtc(addCalendarDays(zonedTodayDate(now), 1), MIDNIGHT);
  return new Date(Math.min(now.getTime() + DEMO_LEASE_MS, endOfDay.getTime()));
}

/** Une réserve n'est prêtée telle quelle que préparée après cet instant : moins de DEMO_FRESH_MS, et le jour même. */
export function demoFreshAfter(now: Date): Date {
  const dayStart = parisWallTimeToUtc(zonedTodayDate(now), MIDNIGHT);
  return new Date(Math.max(now.getTime() - DEMO_FRESH_MS, dayStart.getTime()));
}

const DEMO_COMPANY_ID_PATTERN = /^demopool_\d{2}_company$/;
const DEMO_LEASE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** Entreprise d'un environnement de démo (identifiant posé par le scénario, jamais réutilisé ailleurs). */
export function isDemoCompanyId(companyId: string | null | undefined): companyId is string {
  return Boolean(companyId && DEMO_COMPANY_ID_PATTERN.test(companyId));
}

export function isDemoLeaseToken(value: string | null | undefined): value is string {
  return Boolean(value && DEMO_LEASE_TOKEN_PATTERN.test(value));
}

export const DEMO_PERSONA_LABELS: Record<DemoPersona, { title: string; description: string }> = {
  client: { title: "Client", description: "Passer la commande de demain, suivre sa livraison, ses factures." },
  admin: { title: "Gérant", description: "Clients, catalogue, commandes du jour, tournées et factures." },
  baker: { title: "Production", description: "Ce qu'il faut produire pour la prochaine tournée, par produit." },
  driver: { title: "Livreur", description: "La tournée du moment, arrêt par arrêt, avec l'itinéraire." },
  pastry: { title: "Atelier", description: "Les produits de l'atelier à produire, les envois aux points de vente et leur stock." },
  seller: {
    title: "Point de vente",
    description: `La tablette du point de vente : réception, clôture du soir, commandes sur mesure. Code responsable : ${DEMO_SHOP_MANAGER_CODE}.`,
  },
};

/** Ordre d'affichage sur la page /demo. */
export const DEMO_PERSONA_ORDER: readonly DemoPersona[] = ["client", "admin", "baker", "pastry", "seller", "driver"];

/**
 * Adresse de la démo : toutes sont en `@demo.annona.example` (DEMO_EMAIL_DOMAIN, domaine réservé, jamais livrable).
 * La garde d'envoi la refuse au plus bas niveau, quel que soit l'appelant.
 */
export function isDemoEmailAddress(address: string): boolean {
  return address.trim().toLowerCase().endsWith("@demo.annona.example");
}

/** Mutations d'API refusées dans la démo : mot de passe, comptes et suppressions (décision d'Orso du 16 novembre). */
const DEMO_BLOCKED_PREFIXES = ["/api/users", "/api/profile", "/api/auth/password-link", "/api/auth/password-recovery", "/api/auth/signup"];

export function demoBlockedApiReason(method: string, pathname: string): string | null {
  const verb = method.toUpperCase();
  if (pathname === "/api/demo" || pathname.startsWith("/api/demo/")) return null;
  if (verb === "DELETE") return "Les suppressions sont désactivées dans la démo.";
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return null;
  const blocked = DEMO_BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return blocked ? "Les comptes et les mots de passe ne se modifient pas dans la démo." : null;
}
