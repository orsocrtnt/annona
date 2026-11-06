export type MemoryRateLimiter = { allow: (fingerprint: string, now: number) => boolean; size: () => number };

/**
 * Compteur en mémoire de l'instance (rien en base) : au plus `limit` événements par empreinte et par fenêtre.
 * Taille bornée : au-delà de `maxKeys`, les entrées expirées puis les plus anciennes sont retirées.
 */
export function createMemoryRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }): MemoryRateLimiter {
  const { limit, windowMs } = options;
  const maxKeys = options.maxKeys ?? 5_000;
  const buckets = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(fingerprint, now) {
      const bucket = buckets.get(fingerprint);
      if (!bucket || now - bucket.startedAt >= windowMs) {
        if (buckets.size >= maxKeys) {
          for (const [key, entry] of buckets) if (now - entry.startedAt >= windowMs) buckets.delete(key);
          while (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        }
        buckets.delete(fingerprint);
        buckets.set(fingerprint, { startedAt: now, count: 1 });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
    size: () => buckets.size,
  };
}
