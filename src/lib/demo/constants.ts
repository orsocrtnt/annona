import type { SystemRole } from "@prisma/client";

/** Identifiants de connexion démo — modifiables après le premier seed. */
export const DEMO_LOGIN_EMAIL = "demo@tutelliv.fr";
export const DEMO_DEFAULT_PASSWORD = "Demo2026!";

export const DEMO_CLIENT_EMAIL = "demo-client@tutelliv.fr";
export const DEMO_DRIVER_EMAIL = "demo-driver@tutelliv.fr";
export const DEMO_COMPANY_SLUG = "logiexpress-demo";
export const DEMO_COMPANY_NAME = "LogiExpress Démo";

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
