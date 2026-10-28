import { createHmac } from "node:crypto";

/**
 * Secret des empreintes anti-abus (formulaire Contact, tentatives de connexion).
 * `CONTACT_HMAC_SECRET` est dédié ; à défaut, repli sur la clé service Supabase pour ne
 * pas casser un déploiement existant. Changer le secret réinitialise seulement les compteurs.
 */
export function getAbuseHmacSecret(): string {
  return process.env.CONTACT_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/** Empreinte HMAC-SHA256 : la valeur brute (adresse IP, e-mail) n'est jamais stockée. */
export function abuseFingerprint(scope: string, value: string, secret: string = getAbuseHmacSecret()) {
  if (!secret) throw new Error("ABUSE_HMAC_SECRET_MISSING");
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}
