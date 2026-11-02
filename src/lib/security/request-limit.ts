import { prisma } from "@/services/prisma/client";
import { LOGIN_RATE_WINDOW_MS } from "@/domains/auth/login-rate-limit.service";
import { abuseFingerprint, getAbuseHmacSecret } from "@/lib/security/abuse-hmac";

/**
 * Limite simple par clé, sur la fenêtre de 15 minutes des connexions dont elle partage la table et la
 * purge (AUDIT-0111, S4). Pas de verrou : quelques requêtes simultanées de plus sont sans conséquence
 * ici. Base indisponible : la requête passe, le service visé décide.
 */
export async function isOverRequestLimit(scope: string, value: string, limit: number, now = new Date()) {
  try {
    const keyHash = abuseFingerprint(scope, value, getAbuseHmacSecret());
    await prisma.authLoginFailure.create({ data: { keyHash, createdAt: now } });
    const count = await prisma.authLoginFailure.count({
      where: { keyHash, createdAt: { gte: new Date(now.getTime() - LOGIN_RATE_WINDOW_MS) } },
    });
    return count > limit;
  } catch {
    return false;
  }
}
