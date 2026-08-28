import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { linkPortalDataToClient } from "@/domains/client-portal/client-data.service";
import type { UserWithRole } from "@/types";
import { COMPANY_USERS_TAKE } from "@/lib/query/list-limits";
import type { CreateUserInput, UpdateProfileInput } from "@/lib/validations/user";

export async function getUserByAuthId(authId: string): Promise<UserWithRole | null> {
  const user = await prisma.user.findUnique({
    where: { authId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      company: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    role: {
      ...user.role,
      permissions: user.role.permissions.map((rp) => rp.permission),
    },
  };
}

export function extractPermissionSlugs(user: UserWithRole): string[] {
  return user.role.permissions.map((p) => p.slug);
}

export async function getUserPermissions(authId: string): Promise<string[]> {
  const user = await getUserByAuthId(authId);
  return user ? extractPermissionSlugs(user) : [];
}

export async function updateLastLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export async function listUsersForCompany(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    include: { role: true },
    orderBy: { createdAt: "desc" },
    take: COMPANY_USERS_TAKE,
  });
}

export async function listCompanyDrivers(companyId: string) {
  return prisma.user.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { systemRole: "DRIVER" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
    orderBy: { firstName: "asc" },
  });
}

export async function listAllUsers() {
  return prisma.user.findMany({
    include: { role: true, company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: COMPANY_USERS_TAKE,
  });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function resolveCompanyIdForUserCreation(
  adminCompanyId: string | null | undefined,
  isSuperAdmin: boolean
): Promise<string | null> {
  if (adminCompanyId) return adminCompanyId;
  if (!isSuperAdmin) return null;
  const company = await prisma.company.findFirst({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    orderBy: { createdAt: "asc" },
  });
  return company?.id ?? null;
}

export async function createUserByAdmin(
  input: CreateUserInput,
  adminCompanyId: string | null | undefined,
  isSuperAdmin = false
) {
  const companyId = await resolveCompanyIdForUserCreation(adminCompanyId, isSuperAdmin);
  if (!companyId) {
    throw new Error("COMPANY_REQUIRED");
  }

  const role = await prisma.role.findUnique({ where: { slug: input.roleSlug } });
  if (!role || !["CLIENT", "DRIVER", "DISPATCHER"].includes(role.systemRole)) {
    throw new Error("INVALID_ROLE");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_EXISTS");

  const password = generateTempPassword();
  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
      throw new Error("EMAIL_EXISTS");
    }
    throw new Error(`SUPABASE_CREATE_FAILED:${authError?.message ?? "unknown"}`);
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        authId: authData.user.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        roleId: role.id,
        companyId,
        status: "ACTIVE",
      },
      include: { role: true, company: true },
    });
  } catch (prismaError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw prismaError;
  }

  if (input.roleSlug === "client") {
    await linkPortalDataToClient(user.id, input.email);
  }

  return { user, temporaryPassword: password };
}

const DELETABLE_ROLES = ["CLIENT", "DRIVER", "DISPATCHER"] as const;

export async function deleteUserByAdmin(
  targetUserId: string,
  adminUserId: string,
  companyId: string | null,
  isSuperAdmin = false
) {
  if (targetUserId === adminUserId) {
    throw new Error("CANNOT_DELETE_SELF");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });

  if (!user) throw new Error("USER_NOT_FOUND");

  if (!isSuperAdmin && user.companyId !== companyId) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!DELETABLE_ROLES.includes(user.role.systemRole as (typeof DELETABLE_ROLES)[number])) {
    throw new Error("ROLE_NOT_DELETABLE");
  }

  const supabase = createAdminClient();

  await prisma.$transaction(async (tx) => {
    if (user.role.systemRole === "DRIVER") {
      await tx.delivery.updateMany({
        where: { driverId: user.id },
        data: { driverId: null, driverName: null },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  const { error } = await supabase.auth.admin.deleteUser(user.authId);
  if (error) {
    console.error("Supabase delete user failed:", error.message);
  }

  return { success: true };
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      avatarUrl: input.avatarUrl || null,
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      company: true,
    },
  });
}

