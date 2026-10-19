import { assertAccountActive } from "@/lib/auth/account-access";
import { prisma } from "@/services/prisma/client";
import { linkPortalDataToClient } from "@/domains/client-portal/client-data.service";
import { hydrateUserWithRole, getUserByAuthId } from "@/domains/user/user.service";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { slugify } from "@/lib/utils";
import type { SystemRole, UserStatus } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { getMiniAdminHomePath } from "@/lib/permissions/mini-admin";

export type AccountType = "company";

interface SyncUserInput {
  authId: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType?: AccountType;
  companyName?: string;
}

export class UserNotProvisionedError extends Error {
  constructor() {
    super("USER_NOT_PROVISIONED");
    this.name = "UserNotProvisionedError";
  }
}

export async function syncUserFromSupabase(
  input: SyncUserInput
): Promise<UserWithRole> {
  const email = normalizeEmail(input.email);

  const existing = await getUserByAuthId(input.authId);

  if (existing) {
    const hydrated = existing;
    assertAccountActive(hydrated);
    await Promise.all([
      prisma.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } }),
      ...(hydrated.role.systemRole === "CLIENT"
        ? [linkPortalDataToClient(existing.id, email, existing.companyId ?? null)] : []),
    ]);
    return hydrated;
  }

  const existingByEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { company: true },
  });

  if (existingByEmail) {
    assertAccountActive(await hydrateUserWithRole(existingByEmail));
    const user = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authId: input.authId,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        lastLoginAt: new Date(),
      },
      include: { company: true },
    });
    await linkPortalDataToClient(user.id, email, user.companyId);
    return hydrateUserWithRole(user);
  }

  // Seuls les administrateurs d'entreprise peuvent s'inscrire eux-mêmes
  if (input.accountType !== "company") {
    throw new UserNotProvisionedError();
  }

  const role = await prisma.role.findUnique({ where: { slug: "company-admin" } });
  if (!role) throw new Error("Role company-admin not found. Run db:seed first.");

  const userCount = await prisma.user.count();
  let company = userCount === 0
    ? await prisma.company.findFirst({
        where: { status: { in: ["ACTIVE", "TRIAL"] } },
        orderBy: { createdAt: "asc" },
      })
    : null;

  if (!company) {
    const name =
      input.companyName?.trim() ||
      email.split("@")[1]?.split(".")[0] ||
      "Mon entreprise";
    company = await prisma.company.create({
      data: {
        name,
        slug: `${slugify(name)}-${Date.now()}`,
        status: "TRIAL",
      },
    });
  }

  const user = await prisma.user.create({
    data: {
      authId: input.authId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "ACTIVE" as UserStatus,
      roleId: role.id,
      companyId: company.id,
      lastLoginAt: new Date(),
    },
    include: { company: true },
  });

  return hydrateUserWithRole(user);
}

export function getDashboardPathForRole(role: SystemRole, settings?: unknown): string {
  const map: Record<SystemRole, string> = {
    SUPER_ADMIN: "/admin",
    COMPANY_ADMIN: "/dashboard",
    MINI_ADMIN: getMiniAdminHomePath(settings),
    DISPATCHER: "/dispatch",
    DRIVER: "/driver",
    CLIENT: "/portal",
  };
  return map[role];
}
