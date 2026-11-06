import type { SystemRole } from "@prisma/client";

/** Identifiants de connexion démo — modifiables après le premier seed. */
export const DEMO_LOGIN_EMAIL = "demo@annona.fr";
export const DEMO_DEFAULT_PASSWORD = "Demo2026!";

export const DEMO_CLIENT_EMAIL = "demo-client@annona.fr";
export const DEMO_DRIVER_EMAIL = "demo-driver@annona.fr";
export const DEMO_COMPANY_SLUG = "logiexpress-demo";
export const DEMO_COMPANY_NAME = "LogiExpress Démo";

/** Comptes figés de la démo — restent après reset, non supprimables. */
export const DEMO_FIXTURE_CLIENTS = [
  { email: DEMO_CLIENT_EMAIL, firstName: "Marie", lastName: "Client Démo" },
  { email: "demo-client-2@annona.fr", firstName: "Sophie", lastName: "Martin" },
  { email: "demo-client-3@annona.fr", firstName: "Louis", lastName: "Bernard" },
  { email: "demo-client-4@annona.fr", firstName: "Camille", lastName: "Petit" },
  { email: "demo-client-5@annona.fr", firstName: "Thomas", lastName: "Moreau" },
] as const;

export const DEMO_FIXTURE_DRIVERS = [
  { email: DEMO_DRIVER_EMAIL, firstName: "Marc", lastName: "Livreur Démo" },
  { email: "demo-driver-2@annona.fr", firstName: "Jean", lastName: "Dupont" },
  { email: "demo-driver-3@annona.fr", firstName: "Karim", lastName: "Benali" },
  { email: "demo-driver-4@annona.fr", firstName: "Sophie", lastName: "Laurent" },
  { email: "demo-driver-5@annona.fr", firstName: "Lucas", lastName: "Garnier" },
] as const;

export function isDemoLockedAccountEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEMO_LOGIN_EMAIL) return true;
  return (
    DEMO_FIXTURE_CLIENTS.some((client) => client.email === normalized) ||
    DEMO_FIXTURE_DRIVERS.some((driver) => driver.email === normalized)
  );
}

export const DEMO_PERSONA_COOKIE = "annona-demo-persona";
export const DEMO_SESSION_COOKIE = "annona-demo-session";
export const DEMO_SESSION_COMPANY_PREFIX = `${DEMO_COMPANY_SLUG}-session-`;
export const DEMO_POOL_COMPANY_PREFIX = `${DEMO_COMPANY_SLUG}-pool-`;
export const DEMO_POOL_KEY = "public";
export const DEMO_POOL_MIN_READY = 3;

/**
 * Version du scénario de démo. À changer à chaque modification du scénario : les espaces
 * du pool préparés avec une autre version sont recyclés par la maintenance du pool.
 */
export const DEMO_SCENARIO_VERSION = "2026-11-05-journee";

export function isDemoScenarioOutdated(settings: unknown): boolean {
  const marker = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>).demoScenarioVersion
    : undefined;
  return marker !== DEMO_SCENARIO_VERSION;
}

export type DemoPersona = "admin" | "client" | "driver";

export const DEMO_PERSONA_LABELS: Record<DemoPersona, string> = {
  admin: "Administrateur",
  client: "Client",
  driver: "Livreur",
};

export const DEMO_PERSONA_PATHS: Record<DemoPersona, string> = {
  admin: "/dashboard",
  client: "/portal",
  driver: "/driver",
};

const PERSONA_ROLE_MAP: Record<DemoPersona, SystemRole> = {
  admin: "COMPANY_ADMIN",
  client: "CLIENT",
  driver: "DRIVER",
};

const ROLE_PERSONA_MAP: Partial<Record<SystemRole, DemoPersona>> = {
  COMPANY_ADMIN: "admin",
  MINI_ADMIN: "admin",
  DISPATCHER: "admin",
  CLIENT: "client",
  DRIVER: "driver",
};

export function demoPersonaForRole(systemRole: SystemRole): DemoPersona {
  return ROLE_PERSONA_MAP[systemRole] ?? "admin";
}

export function systemRoleForDemoPersona(persona: DemoPersona): SystemRole {
  return PERSONA_ROLE_MAP[persona];
}

export function isDemoLoginEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_LOGIN_EMAIL;
}

export function demoPersonaAuthId(persona: "client" | "driver", companyId: string): string {
  return `demo-persona-${persona}-${companyId}`;
}

export function demoFixtureAuthId(key: string, companyId: string): string {
  return `demo-persona-${key}-${companyId}`;
}
