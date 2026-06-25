import { prisma } from "@/services/prisma/client";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import {
  DEMO_CLIENT_EMAIL,
  DEMO_DRIVER_EMAIL,
  DEMO_LOGIN_EMAIL,
  demoPersonaAuthId,
  type DemoPersona,
  systemRoleForDemoPersona,
} from "@/lib/demo/constants";

const userInclude = {
  role: {
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  },
  company: true,
} as const;

function toUserWithRole(
  user: NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.user.findFirst<{
          include: typeof userInclude;
        }>
      >
    >
  >
): UserWithRole {
  return {
    ...user,
    role: {
      ...user.role,
      permissions: user.role.permissions.map((rp) => rp.permission),
    },
  } as UserWithRole;
}

export async function getUserWithRoleById(userId: string): Promise<UserWithRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });
  return user ? toUserWithRole(user) : null;
}

export async function getDemoCompany() {
  return prisma.company.findFirst({
    where: { isDemo: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDemoPersonaUser(
  companyId: string,
  persona: DemoPersona
): Promise<UserWithRole | null> {
  if (persona === "admin") {
    const admin = await prisma.user.findFirst({
      where: {
        companyId,
        email: DEMO_LOGIN_EMAIL,
        role: { systemRole: "COMPANY_ADMIN" },
      },
      include: userInclude,
    });
    return admin ? toUserWithRole(admin) : null;
  }

  const email = persona === "client" ? DEMO_CLIENT_EMAIL : DEMO_DRIVER_EMAIL;
  const user = await prisma.user.findFirst({
    where: { companyId, email },
    include: userInclude,
  });
  return user ? toUserWithRole(user) : null;
}

export async function getDemoPersonaUsers(companyId: string) {
  const [admin, client, driver] = await Promise.all([
    getDemoPersonaUser(companyId, "admin"),
    getDemoPersonaUser(companyId, "client"),
    getDemoPersonaUser(companyId, "driver"),
  ]);

  return { admin, client, driver };
}

export function personaAuthIdForRole(
  companyId: string,
  systemRole: SystemRole
): string | null {
  if (systemRole === "CLIENT") return demoPersonaAuthId("client", companyId);
  if (systemRole === "DRIVER") return demoPersonaAuthId("driver", companyId);
  return null;
}

export function demoPersonaSeedUsers(companyId: string) {
  return [
    {
      persona: "admin" as const,
      email: DEMO_LOGIN_EMAIL,
      firstName: "Alex",
      lastName: "Démo",
      roleSlug: "company-admin" as const,
      authId: null as string | null,
      phone: "0600000001",
    },
    {
      persona: "client" as const,
      email: DEMO_CLIENT_EMAIL,
      firstName: "Marie",
      lastName: "Client Démo",
      roleSlug: "client" as const,
      authId: demoPersonaAuthId("client", companyId),
      phone: null as string | null,
    },
    {
      persona: "driver" as const,
      email: DEMO_DRIVER_EMAIL,
      firstName: "Marc",
      lastName: "Chauffeur Démo",
      roleSlug: "driver" as const,
      authId: demoPersonaAuthId("driver", companyId),
      phone: "0600000002",
    },
  ];
}

export function roleSlugForPersona(persona: DemoPersona): string {
  const map: Record<DemoPersona, string> = {
    admin: "company-admin",
    client: "client",
    driver: "driver",
  };
  return map[persona];
}

export function systemRoleForPersona(persona: DemoPersona): SystemRole {
  return systemRoleForDemoPersona(persona);
}
