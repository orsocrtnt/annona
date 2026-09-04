import type { SystemRole } from "@prisma/client";

/** Identifiants de connexion démo — modifiables après le premier seed. */
export const DEMO_LOGIN_EMAIL = "demo@tutelliv.fr";
export const DEMO_DEFAULT_PASSWORD = "Demo2026!";

export const DEMO_CLIENT_EMAIL = "demo-client@tutelliv.fr";
export const DEMO_DRIVER_EMAIL = "demo-driver@tutelliv.fr";
export const DEMO_COMPANY_SLUG = "logiexpress-demo";
export const DEMO_COMPANY_NAME = "LogiExpress Démo";

/** Comptes figés de la démo — restent après reset, non supprimables. */
export const DEMO_FIXTURE_CLIENTS = [
  { email: DEMO_CLIENT_EMAIL, firstName: "Marie", lastName: "Client Démo" },
  { email: "demo-client-2@tutelliv.fr", firstName: "Sophie", lastName: "Martin" },
  { email: "demo-client-3@tutelliv.fr", firstName: "Louis", lastName: "Bernard" },
  { email: "demo-client-4@tutelliv.fr", firstName: "Camille", lastName: "Petit" },
  { email: "demo-client-5@tutelliv.fr", firstName: "Thomas", lastName: "Moreau" },
] as const;

export const DEMO_FIXTURE_DRIVERS = [
  { email: DEMO_DRIVER_EMAIL, firstName: "Marc", lastName: "Chauffeur Démo" },
  { email: "demo-driver-2@tutelliv.fr", firstName: "Jean", lastName: "Dupont" },
] as const;

export function isDemoLockedAccountEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEMO_LOGIN_EMAIL) return true;
  return (
    DEMO_FIXTURE_CLIENTS.some((client) => client.email === normalized) ||
    DEMO_FIXTURE_DRIVERS.some((driver) => driver.email === normalized)
  );
}

export const DEMO_PERSONA_COOKIE = "tutelliv-demo-persona";

export type DemoPersona = "admin" | "client" | "driver";

export const DEMO_PERSONA_LABELS: Record<DemoPersona, string> = {
  admin: "Administrateur",
  client: "Client",
  driver: "Chauffeur",
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
