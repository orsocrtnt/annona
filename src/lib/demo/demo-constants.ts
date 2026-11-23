/**
 * DEMO-1 — constantes de la démo publique, sans dépendance serveur (lisibles par la page /demo et le middleware).
 *
 * Une démo par visiteur : un environnement `demopool_NN_…` lui est prêté pour DEMO_LEASE_MS. Le prêt est porté
 * par le cookie DEMO_LEASE_COOKIE (jeton aléatoire, seule son empreinte est en base) : sans ce cookie, un compte
 * de démo ne s'ouvre pas, donc un visiteur ne peut pas entrer dans l'environnement d'un autre.
 */
import type { DemoPersona } from "@/domains/demo/demo-scenario";

export const DEMO_LEASE_COOKIE = "annona-demo-lease";
/** Durée d'un prêt : 4 heures. */
export const DEMO_LEASE_MS = 4 * 60 * 60 * 1000;
/** Nombre maximal d'environnements de démo (visiteurs simultanés). */
export const DEMO_MAX_SLOTS = 20;
/** Un environnement resté « en préparation » plus longtemps est considéré comme abandonné (échec, coupure). */
export const DEMO_PREPARING_STALE_MS = 10 * 60 * 1000;

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
  client: { title: "Commerçant", description: "Passer la commande de demain, suivre sa livraison, ses factures." },
  admin: { title: "Gérant de la boulangerie", description: "Clients, catalogue, commandes du jour, tournées et factures." },
  baker: { title: "Boulanger", description: "Ce qu'il faut produire pour la prochaine tournée, par produit." },
  driver: { title: "Livreur", description: "La tournée du moment, arrêt par arrêt, avec l'itinéraire." },
};

/** Ordre d'affichage sur la page /demo. */
export const DEMO_PERSONA_ORDER: readonly DemoPersona[] = ["client", "admin", "baker", "driver"];

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
