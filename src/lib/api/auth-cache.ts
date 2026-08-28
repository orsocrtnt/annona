import type { UserWithRole } from "@/types";

interface CachedAuth {
  user: UserWithRole;
  permissions: string[];
  expiresAt: number;
}

const cache = new Map<string, CachedAuth>();
const inflight = new Map<string, Promise<CachedAuth | null>>();
const TTL_MS = 60_000;

export function getCachedAuth(authId: string): CachedAuth | null {
  const entry = cache.get(authId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(authId);
    return null;
  }
  return entry;
}

export function setCachedAuth(
  authId: string,
  user: UserWithRole,
  permissions: string[]
): void {
  cache.set(authId, {
    user,
    permissions,
    expiresAt: Date.now() + TTL_MS,
  });
}

/** Une seule lecture Prisma user si N APIs partent en même temps. */
export function loadAuthOnce(
  authId: string,
  loader: () => Promise<{ user: UserWithRole; permissions: string[] } | null>
): Promise<CachedAuth | null> {
  const cached = getCachedAuth(authId);
  if (cached) return Promise.resolve(cached);

  let pending = inflight.get(authId);
  if (!pending) {
    pending = loader()
      .then((data) => {
        if (!data) return null;
        setCachedAuth(authId, data.user, data.permissions);
        return getCachedAuth(authId);
      })
      .finally(() => {
        inflight.delete(authId);
      });
    inflight.set(authId, pending);
  }
  return pending;
}

export function clearAuthCache(authId?: string): void {
  if (authId) cache.delete(authId);
  else cache.clear();
}
