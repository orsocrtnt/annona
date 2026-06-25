import type { UserWithRole } from "@/types";

interface CachedAuth {
  user: UserWithRole;
  permissions: string[];
  expiresAt: number;
}

const cache = new Map<string, CachedAuth>();
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

export function clearAuthCache(authId?: string): void {
  if (authId) cache.delete(authId);
  else cache.clear();
}
