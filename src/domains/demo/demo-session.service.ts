import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import {
  DEMO_COMPANY_NAME,
  DEMO_SESSION_COMPANY_PREFIX,
} from "@/lib/demo/constants";
import { ensureDemoSessionRosterUsers } from "@/domains/demo/demo-users.service";
import { resetDemoScenario } from "@/domains/demo/demo-scenario.service";
import { DEFAULT_DISPATCH_SETTINGS } from "@/lib/validations/dispatch-settings";
import { demoRetentionSettings, demoSessionExpiry } from "@/lib/demo/retention";
import { AccountUnavailableError } from "@/lib/auth/account-access";
import {
  demoSessionIdFromRequestKey,
  getActiveDemoPoolLease,
  leaseDemoPoolEnvironment,
} from "@/domains/demo/demo-pool.service";

const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;

export function createDemoSessionId(): string {
  return randomBytes(32).toString("hex");
}

export function demoSessionCompanySlug(sessionId: string): string {
  const digest = createHash("sha256").update(sessionId).digest("hex").slice(0, 24);
  return `${DEMO_SESSION_COMPANY_PREFIX}${digest}`;
}

function isValidSessionId(value: string | null): value is string {
  return Boolean(value && SESSION_ID_PATTERN.test(value));
}

function safeSessionSettings(raw: Prisma.JsonValue | null, createdAt: Date): Prisma.InputJsonValue {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  delete source.dispatch;
  delete source.dispatchRules;
  delete source.deliveryOptions;
  return {
    ...source,
    deliveryCategories: {
      STANDARD: true,
      COURIER: true,
      SPECIAL_MISSION: false,
    },
    dispatchRules: DEFAULT_DISPATCH_SETTINGS,
    demoSession: true,
    demoRetention: demoRetentionSettings(createdAt),
  } as Prisma.InputJsonValue;
}

export async function ensureDemoSessionEnvironment(
  baseCompanyId: string,
  sessionId: string
): Promise<{ companyId: string; created: boolean }> {
  if (!isValidSessionId(sessionId)) throw new Error("DEMO_SESSION_INVALID");
  const slug = demoSessionCompanySlug(sessionId);
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    const expiry = demoSessionExpiry(existing);
    if (!existing.isDemo || existing.status === "INACTIVE" || !expiry || expiry.getTime() <= Date.now()) {
      throw new Error("DEMO_SESSION_UNAVAILABLE");
    }
    const [adminCount, orderCount] = await Promise.all([
      prisma.user.count({
        where: { companyId: existing.id, role: { systemRole: "COMPANY_ADMIN" } },
      }),
      prisma.order.count({ where: { companyId: existing.id } }),
    ]);
    if (adminCount === 0 || orderCount === 0) {
      await ensureDemoSessionRosterUsers(existing.id);
      await resetDemoScenario(existing.id, new Date(), { ensureCanonicalRoster: false });
    }
    return { companyId: existing.id, created: false };
  }

  const base = await prisma.company.findFirst({
    where: { id: baseCompanyId, isDemo: true, status: { in: ["ACTIVE", "TRIAL"] } },
  });
  if (!base) throw new Error("DEMO_BASE_COMPANY_UNAVAILABLE");

  let company;
  const createdAt = new Date();
  const expiresAt = new Date(demoRetentionSettings(createdAt).expiresAt);
  try {
    company = await prisma.company.create({
      data: {
        name: `${DEMO_COMPANY_NAME} — session isolée`,
        slug,
        isDemo: true,
        status: "ACTIVE",
        email: base.email,
        phone: base.phone,
        address: base.address,
        city: base.city,
        country: base.country,
        createdAt,
        settings: safeSessionSettings(base.settings, createdAt),
        saasSubscription: {
          create: {
            kind: "PILOT",
            status: "ACTIVE",
            startsAt: createdAt,
            currentPeriodStart: createdAt,
            currentPeriodEnd: expiresAt,
            snapshot: {
              schemaVersion: 1,
              mode: "PILOT",
              limits: {
                drivers: null,
                admins: null,
                dispatchers: null,
                monthlyOrders: 2147483647,
              },
              orderOverageUnitPriceCents: 0,
              features: [
                "auto_dispatch",
                "admin_gps",
                "client_gps",
                "advanced_analytics",
                "priority_support",
              ],
            },
          },
        },
      },
    });
  } catch (error) {
    const raced = await prisma.company.findUnique({ where: { slug } });
    if (!raced) throw error;
    const expiry = demoSessionExpiry(raced);
    if (!raced.isDemo || raced.status === "INACTIVE" || !expiry || expiry.getTime() <= Date.now()) throw new Error("DEMO_SESSION_UNAVAILABLE");
    company = raced;
  }

  await ensureDemoSessionRosterUsers(company.id);
  await resetDemoScenario(company.id, new Date(), { ensureCanonicalRoster: false });
  return { companyId: company.id, created: true };
}

export async function ensureDemoSessionForLogin(
  baseCompanyId: string,
  requestKey?: string
): Promise<string> {
  const { getDemoSessionCookie, setDemoSessionCookie } = await import(
    "@/lib/demo/persona-cookie"
  );
  const stored = await getDemoSessionCookie();
  if (isValidSessionId(stored)) {
    const poolLease = await getActiveDemoPoolLease(stored);
    if (poolLease) return poolLease.companyId;
  }

  // Compatibilité transitoire : les sessions DEMO-1 déjà ouvertes restent
  // accessibles jusqu'à leur expiration, sans passer par le nouveau pool.
  const previous = isValidSessionId(stored)
    ? await prisma.company.findUnique({ where: { slug: demoSessionCompanySlug(stored) } })
    : null;
  const expiry = previous && demoSessionExpiry(previous);
  const reuse = previous && previous.status !== "INACTIVE" && expiry && expiry.getTime() > Date.now();
  if (isValidSessionId(stored) && reuse) return previous.id;

  // `baseCompanyId` provient du compte Supabase démo déjà relu et contrôlé dans
  // la route. Ne pas refaire cette lecture sur le chemin critique DEMO-2.
  if (!baseCompanyId) throw new Error("DEMO_BASE_COMPANY_UNAVAILABLE");

  const sessionId = requestKey
    ? demoSessionIdFromRequestKey(requestKey)
    : createDemoSessionId();
  const lease = await leaseDemoPoolEnvironment(sessionId);
  await setDemoSessionCookie(sessionId);
  return lease.companyId;
}

export async function getDemoSessionCompanyId(): Promise<string | null> {
  const { getDemoSessionCookie } = await import("@/lib/demo/persona-cookie");
  const sessionId = await getDemoSessionCookie();
  if (!isValidSessionId(sessionId)) return null;
  const poolLease = await getActiveDemoPoolLease(sessionId);
  if (poolLease) return poolLease.companyId;
  const company = await prisma.company.findUnique({
    where: { slug: demoSessionCompanySlug(sessionId) },
    select: { id: true, isDemo: true, status: true, slug: true, settings: true, createdAt: true },
  });
  if (!company?.isDemo || company.status === "INACTIVE") throw new AccountUnavailableError();
  const expiry = demoSessionExpiry(company);
  if (!expiry || expiry.getTime() <= Date.now()) throw new AccountUnavailableError();
  return company.id;
}
