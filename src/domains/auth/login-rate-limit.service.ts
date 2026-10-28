import { prisma } from "@/services/prisma/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { abuseFingerprint } from "@/lib/security/abuse-hmac";

/** SEC-2 : au plus 5 échecs par e-mail et 30 par source sur 15 minutes glissantes. */
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_EMAIL_FAILURE_LIMIT = 5;
export const LOGIN_SOURCE_FAILURE_LIMIT = 30;

export type LoginAttemptKeys = { emailKey: string | null; sourceKey: string };
export type LoginRateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };
type LoginAttemptDatabase = Pick<typeof prisma, "authLoginFailure">;

/**
 * Empreintes HMAC de l'e-mail normalisé et de la source. `trackEmail: false` sert au compte
 * de démonstration public : son e-mail ne doit pas pouvoir être verrouillé par un tiers.
 */
export function loginAttemptKeys(
  email: string,
  source: string,
  options: { secret?: string; trackEmail?: boolean } = {}
): LoginAttemptKeys {
  return {
    emailKey: options.trackEmail === false ? null : abuseFingerprint("login-email", normalizeEmail(email), options.secret),
    sourceKey: abuseFingerprint("login-source", source, options.secret),
  };
}

async function retryAfter(db: LoginAttemptDatabase, keyHash: string, limit: number, now: Date) {
  const recent = await db.authLoginFailure.findMany({
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
 * Lecture seule, avant tout appel à Supabase. La réponse ne dépend que des échecs comptés,
 * jamais de l'existence du compte. Base indisponible (ou migration non appliquée) : la
 * connexion reste permise, l'erreur est journalisée.
 */
export async function checkLoginRateLimit(
  keys: LoginAttemptKeys,
  options: { now?: Date; db?: LoginAttemptDatabase } = {}
): Promise<LoginRateLimitResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  try {
    const [byEmail, bySource] = await Promise.all([
      keys.emailKey ? retryAfter(db, keys.emailKey, LOGIN_EMAIL_FAILURE_LIMIT, now) : 0,
      retryAfter(db, keys.sourceKey, LOGIN_SOURCE_FAILURE_LIMIT, now),
    ]);
    const wait = Math.max(byEmail, bySource);
    return wait > 0 ? { allowed: false, retryAfterSeconds: wait } : { allowed: true };
  } catch (error) {
    console.error("Login rate limit check failed:", error instanceof Error ? error.message : "unknown");
    return { allowed: true };
  }
}

/** Enregistre un échec d'identifiants et purge les échecs sortis de la fenêtre. */
export async function recordLoginFailure(
  keys: LoginAttemptKeys,
  options: { now?: Date; db?: LoginAttemptDatabase } = {}
): Promise<void> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const keyHashes = [keys.emailKey, keys.sourceKey].filter((key): key is string => Boolean(key));
  try {
    await Promise.all([
      db.authLoginFailure.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - LOGIN_RATE_WINDOW_MS) } } }),
      db.authLoginFailure.createMany({ data: keyHashes.map((keyHash) => ({ keyHash, createdAt: now })) }),
    ]);
  } catch (error) {
    console.error("Login failure record failed:", error instanceof Error ? error.message : "unknown");
  }
}

/**
 * Après une connexion réussie, seul le compteur de l'e-mail repart à zéro : celui de la
 * source est conservé, sinon un compte valide permettrait d'essayer d'autres adresses.
 */
export async function clearLoginFailures(
  keys: LoginAttemptKeys,
  options: { db?: LoginAttemptDatabase } = {}
): Promise<void> {
  if (!keys.emailKey) return;
  const db = options.db ?? prisma;
  try {
    await db.authLoginFailure.deleteMany({ where: { keyHash: keys.emailKey } });
  } catch (error) {
    console.error("Login failure reset failed:", error instanceof Error ? error.message : "unknown");
  }
}
