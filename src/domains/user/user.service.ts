import { Prisma, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { linkPortalDataToClient } from "@/domains/client-portal/client-data.service";
import type { UserWithRole } from "@/types";
import { COMPANY_USERS_TAKE } from "@/lib/query/list-limits";
import type { CreateUserInput, UpdateMiniAdminInput, UpdateProfileInput } from "@/lib/validations/user";
import { filterMiniAdminPermissions, buildMiniAdminSettings } from "@/lib/permissions/mini-admin";
import { isDemoLockedAccountEmail } from "@/lib/demo/constants";

type RoleRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemRole: SystemRole;
  isSystem: boolean;
};

/** Lit les rôles en SQL pour éviter le décodage Prisma d’un enum SystemRole trop ancien en mémoire. */
async function fetchRolesByIds(ids: string[]): Promise<Map<string, RoleRecord>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      system_role: string;
      is_system: boolean;
    }>
  >`
    SELECT id, name, slug, description, system_role, is_system
    FROM roles
    WHERE id IN (${Prisma.join(unique)})
  `;

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        systemRole: row.system_role as SystemRole,
        isSystem: row.is_system,
      },
    ])
  );
}

export async function hydrateUserWithRole<T extends { roleId: string }>(
  user: T
): Promise<T & { role: UserWithRole["role"] }> {
  const role = (await fetchRolesByIds([user.roleId])).get(user.roleId);
  if (!role) {
    throw new Error("ROLE_NOT_FOUND");
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    include: { permission: true },
  });

  return {
    ...user,
    role: {
      ...role,
      permissions: rolePermissions.map((rp) => rp.permission),
    },
  };
}

export async function attachRolesById<T extends { roleId: string }>(
  users: T[]
): Promise<Array<T & { role: RoleRecord }>> {
  const roles = await fetchRolesByIds(users.map((user) => user.roleId));
  return users.map((user) => {
    const role = roles.get(user.roleId);
    if (!role) throw new Error("ROLE_NOT_FOUND");
    return { ...user, role };
  });
}

export async function getUserByAuthId(authId: string): Promise<UserWithRole | null> {
  const user = await prisma.user.findUnique({
    where: { authId },
    include: { company: true },
  });

  if (!user) return null;
  return hydrateUserWithRole(user);
}

export function extractPermissionSlugs(user: UserWithRole): string[] {
  const slugs = user.role.permissions.map((p) => p.slug);
  if (user.role.systemRole !== "MINI_ADMIN") return slugs;
  return filterMiniAdminPermissions(slugs, user.settings);
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
  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: COMPANY_USERS_TAKE,
  });
  const roles = await fetchRolesByIds(users.map((user) => user.roleId));
  return users.map((user) => {
    const role = roles.get(user.roleId);
    if (!role) throw new Error("ROLE_NOT_FOUND");
    return { ...user, role };
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
  const users = await prisma.user.findMany({
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: COMPANY_USERS_TAKE,
  });
  const roles = await fetchRolesByIds(users.map((user) => user.roleId));
  return users.map((user) => {
    const role = roles.get(user.roleId);
    if (!role) throw new Error("ROLE_NOT_FOUND");
    return { ...user, role };
  });
}

const CREATABLE_SYSTEM_ROLES = ["CLIENT", "DRIVER", "MINI_ADMIN"] as const;

async function findCreatableRoleBySlug(slug: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string; slug: string; system_role: string }>
  >`
    SELECT id, name, slug, system_role FROM roles WHERE slug = ${slug} LIMIT 1
  `;
  const row = rows[0];
  if (
    !row ||
    !CREATABLE_SYSTEM_ROLES.includes(row.system_role as (typeof CREATABLE_SYSTEM_ROLES)[number])
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    systemRole: row.system_role as (typeof CREATABLE_SYSTEM_ROLES)[number],
  };
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

  const role = await findCreatableRoleBySlug(input.roleSlug);
  if (!role) {
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
        ...(input.roleSlug === "mini-admin"
          ? {
              settings: buildMiniAdminSettings(
                input.miniAdminTitle ?? "",
                input.miniAdminModules ?? []
              ),
            }
          : {}),
      },
      include: { company: true },
    });
  } catch (prismaError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw prismaError;
  }

  if (input.roleSlug === "client") {
    await linkPortalDataToClient(user.id, input.email);
  }

  return {
    user: {
      ...user,
      role: {
        id: role.id,
        name: role.name,
        slug: role.slug,
        systemRole: role.systemRole,
      },
    },
    temporaryPassword: password,
  };
}

const DELETABLE_ROLES = ["CLIENT", "DRIVER", "DISPATCHER", "MINI_ADMIN"] as const;

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
  });

  if (!user) throw new Error("USER_NOT_FOUND");

  if (!isSuperAdmin && user.companyId !== companyId) {
    throw new Error("USER_NOT_FOUND");
  }

  const role = (await fetchRolesByIds([user.roleId])).get(user.roleId);
  if (!role) throw new Error("USER_NOT_FOUND");

  if (isDemoLockedAccountEmail(user.email)) {
    throw new Error("DEMO_ACCOUNT_LOCKED");
  }

  if (!DELETABLE_ROLES.includes(role.systemRole as (typeof DELETABLE_ROLES)[number])) {
    throw new Error("ROLE_NOT_DELETABLE");
  }

  const supabase = createAdminClient();

  await prisma.$transaction(async (tx) => {
    if (role.systemRole === "DRIVER") {
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

export async function updateMiniAdminByAdmin(
  targetUserId: string,
  input: UpdateMiniAdminInput,
  companyId: string | null,
  isSuperAdmin = false
) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  if (!isSuperAdmin && user.companyId !== companyId) {
    throw new Error("USER_NOT_FOUND");
  }

  const role = (await fetchRolesByIds([user.roleId])).get(user.roleId);
  if (!role || role.systemRole !== "MINI_ADMIN") {
    throw new Error("ROLE_NOT_EDITABLE");
  }

  const current =
    user.settings && typeof user.settings === "object" && !Array.isArray(user.settings)
      ? (user.settings as Record<string, unknown>)
      : {};

  await prisma.user.update({
    where: { id: user.id },
    data: {
      settings: {
        ...current,
        ...buildMiniAdminSettings(input.miniAdminTitle, input.miniAdminModules),
      },
    },
  });

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

