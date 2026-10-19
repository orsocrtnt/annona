import type { Prisma } from "@prisma/client";
import { DEMO_SESSION_COMPANY_PREFIX } from "@/lib/demo/constants";

export const DEMO_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
// Allow already-authorized requests to finish before the first cleanup attempt.
export const DEMO_CLEANUP_GRACE_MS = 60 * 60 * 1000;

export function demoRetentionSettings(createdAt: Date) {
  return { version: 1, expiresAt: new Date(createdAt.getTime() + DEMO_SESSION_LIFETIME_MS).toISOString() };
}

export function demoSessionExpiry(company: {
  isDemo: boolean; slug: string; createdAt: Date; settings: Prisma.JsonValue | null;
}): Date | null {
  if (!company.isDemo || !new RegExp(`^${DEMO_SESSION_COMPANY_PREFIX}[a-f0-9]{24}$`).test(company.slug)) return null;
  const settings = company.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings) || settings.demoSession !== true) return null;
  const retention = settings.demoRetention;
  if (!retention || typeof retention !== "object" || Array.isArray(retention) || retention.version !== 1) return null;
  const expected = demoRetentionSettings(company.createdAt).expiresAt;
  return retention.expiresAt === expected ? new Date(expected) : null;
}
