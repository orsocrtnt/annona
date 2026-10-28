import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { abuseFingerprint } from "@/lib/security/abuse-hmac";

/** SEC-2 : au plus 5 échecs par e-mail et 30 par source sur 15 minutes glissantes. */
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_EMAIL_FAILURE_LIMIT = 5;
export const LOGIN_SOURCE_FAILURE_LIMIT = 30;

export type LoginAttemptKeys = { emailKey: string | null; sourceKey: string | null };
/** Tentative réservée : ses lignes comptent comme un échec tant qu'elle n'est pas soldée. */
export type LoginAttempt = { keys: LoginAttemptKeys; ids: string[] };
export type LoginAttemptGate =
  | { allowed: true; attempt: LoginAttempt | null }
  | { allowed: false; retryAfterSeconds: number };
type LoginAttemptDatabase = Pick<typeof prisma, "authLoginFailure" | "$transaction">;
type LoginAttemptTx = Pick<Prisma.TransactionClient, "authLoginFailure" | "$queryRaw">;

/** Valeur de `contactSourceFromHeaders` sans x-forwarded-for ni x-real-ip. */
const UNKNOWN_SOURCE = "unknown";

/**
 * Empreintes HMAC de l'e-mail normalisé et de la source. `trackEmail: false` sert au compte
 * de démonstration public : son e-mail ne doit pas pouvoir être verrouillé par un tiers.
 * Source inconnue (dev, E2E, proxy sans en-tête) : pas de clé, sinon toutes les requêtes
 * partageraient un seau global que n'importe qui pourrait remplir.
 */
export function loginAttemptKeys(
  email: string,
  source: string,
  options: { secret?: string; trackEmail?: boolean } = {}
): LoginAttemptKeys {
  return {
    emailKey: options.trackEmail === false ? null : abuseFingerprint("login-email", normalizeEmail(email), options.secret),
    sourceKey: !source.trim() || source === UNKNOWN_SOURCE ? null : abuseFingerprint("login-source", source, options.secret),
  };
}

function limitedKeys(keys: LoginAttemptKeys) {
  return [
    keys.emailKey ? { keyHash: keys.emailKey, limit: LOGIN_EMAIL_FAILURE_LIMIT } : null,
    keys.sourceKey ? { keyHash: keys.sourceKey, limit: LOGIN_SOURCE_FAILURE_LIMIT } : null,
  ].filter((entry): entry is { keyHash: string; limit: number } => entry !== null);
}

async function retryAfter(tx: LoginAttemptTx, keyHash: string, limit: number, now: Date) {
  const recent = await tx.authLoginFailure.findMany({
    where: { keyHash, createdAt: { gte: new Date(now.getTime() - LOGIN_RATE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { createdAt: true },
  });
  if (recent.length < limit) return 0;
  // Libéré quand le plus ancien des `limit` échecs récents sort de la fenêtre.
  const releaseAt = recent[limit - 1]!.createdAt.getTime() + LOGIN_RATE_WINDOW_MS;
  return Math.max(1, Math.ceil((releaseAt - now.getTime()) / 1000));
}

/**
 * Avant Supabase : comptage puis réservation sous verrou consultatif par clé (ordre trié,
 * sans interblocage), si bien que des requêtes simultanées ne dépassent pas la limite. La
 * réponse ne dépend que des échecs comptés, jamais de l'existence du compte. Base
 * indisponible (ou migration non appliquée) : connexion permise, erreur journalisée.
 */
export async function beginLoginAttempt(
  keys: LoginAttemptKeys,
  options: { now?: Date; db?: LoginAttemptDatabase } = {}
): Promise<LoginAttemptGate> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const limited = limitedKeys(keys).sort((a, b) => a.keyHash.localeCompare(b.keyHash));
  try {
    return await db.$transaction(async (tx) => {
      for (const { keyHash } of limited) {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${keyHash}))`;
      }
      let wait = 0;
      for (const { keyHash, limit } of limited) wait = Math.max(wait, await retryAfter(tx, keyHash, limit, now));
      if (wait > 0) return { allowed: false, retryAfterSeconds: wait } as const;
      const ids: string[] = [];
      for (const { keyHash } of limited) ids.push((await tx.authLoginFailure.create({ data: { keyHash, createdAt: now }, select: { id: true } })).id);
      return { allowed: true, attempt: { keys, ids } } as const;
    });
  } catch (error) {
    console.error("Login rate limit check failed:", error instanceof Error ? error.message : "unknown");
    return { allowed: true, attempt: null };
  }
}

/**
 * Échec d'identifiants : la réservation reste comptée. Succès : elle est retirée et le
 * compteur de l'e-mail repart à zéro (celui de la source est conservé, sinon un compte valide
 * permettrait d'essayer d'autres adresses). Panne fournisseur : réservation retirée.
 */
export async function settleLoginAttempt(
  attempt: LoginAttempt | null,
  outcome: "failure" | "success" | "cancelled",
  options: { now?: Date; db?: LoginAttemptDatabase } = {}
): Promise<void> {
  if (!attempt) return;
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  try {
    if (outcome === "failure") {
      await db.authLoginFailure.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - LOGIN_RATE_WINDOW_MS) } } });
      return;
    }
    await db.authLoginFailure.deleteMany({ where: { id: { in: attempt.ids } } });
    if (outcome === "success" && attempt.keys.emailKey) {
      await db.authLoginFailure.deleteMany({ where: { keyHash: { in: [attempt.keys.emailKey] } } });
    }
  } catch (error) {
    console.error("Login attempt settlement failed:", error instanceof Error ? error.message : "unknown");
  }
}
