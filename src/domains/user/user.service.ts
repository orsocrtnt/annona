import { Prisma, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import type { UserWithRole } from "@/types";
import { COMPANY_USERS_TAKE } from "@/lib/query/list-limits";
import type { CreateUserInput, UpdateProfileInput } from "@/lib/validations/user";
import { getPasswordLinkRedirect } from "@/lib/auth/email-links";

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
  // Lectures indépendantes, sans cache des droits entre requêtes.
  const [roles, rolePermissions] = await Promise.all([
    fetchRolesByIds([user.roleId]),
    prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: true },
    }),
  ]);
  const role = roles.get(user.roleId);
  if (!role) throw new Error("ROLE_NOT_FOUND");

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
  // Lecture relationnelle fraîche sans la stratégie relationJoins expérimentale :
  // Prisma 5.22 panique sous des lectures auth concurrentes avec cette stratégie.
  // Aucune mémorisation inter-requêtes (suspension/révocation immédiates).
  const user = await prisma.user.findUnique({
    where: { authId },
    include: {
      company: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!user) return null;
  return {
    ...user,
    role: { ...user.role, permissions: user.role.permissions.map((rp) => rp.permission) },
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
  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: COMPANY_USERS_TAKE,
    include: { merchant: { select: { id: true, name: true, tradeName: true } } },
  });
  const roles = await fetchRolesByIds(users.map((user) => user.roleId));
  return users.map((user) => {
    const role = roles.get(user.roleId);
    if (!role) throw new Error("ROLE_NOT_FOUND");
    // Ni réglages ni identifiant d'authentification dans la liste renvoyée au navigateur.
    const rest = { ...user } as Partial<typeof user>;
    delete rest.settings;
    delete rest.authId;
    return {
      ...rest,
      merchant: user.merchant ? { id: user.merchant.id, name: user.merchant.tradeName || user.merchant.name } : null,
      role,
    };
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

/** Comptes qu'un administrateur ouvre dans son entreprise ; un compte client est rattaché à un client (ADM-1). */
const CREATABLE_SYSTEM_ROLES = ["ADMIN", "BAKER", "DRIVER", "MERCHANT"] as const;

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

/**
 * Compte d'authentification d'un nouvel utilisateur (ADM-01, PLA-02) : invitation Supabase par e-mail
 * quand les liens sont configurés (`AUTH_EMAIL_LINKS_ENABLED`) ; sinon compte créé en attente, sans mot
 * de passe ni e-mail : la personne choisira son mot de passe par « Mot de passe oublié » une fois l'envoi
 * activé. Erreurs : EMAIL_EXISTS, AUTH_RATE_LIMITED, INVITATION_FAILED.
 */
export async function inviteAuthUser(email: string, metadata: { first_name: string; last_name: string }) {
  const supabase = createAdminClient();
  let redirectTo: string | null = null;
  try {
    redirectTo = getPasswordLinkRedirect();
  } catch (error) {
    if (!(error instanceof Error && error.message === "AUTH_EMAIL_NOT_CONFIGURED")) throw error;
  }
  const { data, error } = redirectTo
    ? await supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata })
    : await supabase.auth.admin.createUser({ email, email_confirm: false, user_metadata: metadata });
  if (error || !data.user) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("exists") || message.includes("registered")) throw new Error("EMAIL_EXISTS");
    throw new Error(error?.status === 429 ? "AUTH_RATE_LIMITED" : "INVITATION_FAILED");
  }
  return { authId: data.user.id, invited: Boolean(redirectTo) };
}

/** Retire un compte d'authentification créé pour rien (création interrompue). */
export async function removeAuthUser(authId: string) {
  await createAdminClient().auth.admin.deleteUser(authId);
}

export async function resolveCompanyIdForUserCreation(
  adminCompanyId: string | null | undefined
): Promise<string> {
  if (!adminCompanyId) throw new Error("COMPANY_REQUIRED");
  return adminCompanyId;
}

export async function createUserByAdmin(
  input: CreateUserInput,
  adminCompanyId: string | null | undefined,
  actorRole: SystemRole
) {
  if (actorRole === "SUPER_ADMIN") throw new Error("PLATFORM_USER_MUTATION_FORBIDDEN");
  const companyId = await resolveCompanyIdForUserCreation(adminCompanyId);

  const role = await findCreatableRoleBySlug(input.roleSlug);
  if (!role) {
    throw new Error("INVALID_ROLE");
  }

  // ADM-1 : un compte client représente un client de la même entreprise ; aucun autre rôle n'en a.
  let merchantId: string | null = null;
  if (role.systemRole === "MERCHANT") {
    const merchant = input.merchantId
      ? await prisma.merchant.findFirst({ where: { id: input.merchantId, companyId }, select: { id: true } })
      : null;
    if (!merchant) throw new Error("MERCHANT_REQUIRED");
    merchantId = merchant.id;
  } else if (input.merchantId) {
    throw new Error("MERCHANT_NOT_ALLOWED");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_EXISTS");

  // Invitation par e-mail (Supabase Auth) quand les liens sont configurés ; sinon compte créé en attente.
  const account = await inviteAuthUser(input.email, { first_name: input.firstName, last_name: input.lastName });

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          authId: account.authId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          roleId: role.id,
          companyId,
          merchantId,
          phone: input.phone?.trim() || null,
          status: "PENDING_VERIFICATION",
        },
        include: { company: true },
      });
      return created;
    });
  } catch {
    // Le fournisseur peut avoir renvoyé une ancienne invitation : ne pas supprimer ce compte.
    // Aucun accès applicatif sans profil ; l’administrateur peut retenter la création.
    throw new Error("INVITATION_PROFILE_FAILED");
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
    invitationSent: account.invited,
  };
}

const DELETABLE_ROLES = ["ADMIN", "BAKER", "DRIVER", "MERCHANT"] as const;

export async function deleteUserByAdmin(
  targetUserId: string,
  adminUserId: string,
  companyId: string | null,
  actorRole: SystemRole
) {
  if (actorRole === "SUPER_ADMIN") throw new Error("PLATFORM_USER_MUTATION_FORBIDDEN");
  if (targetUserId === adminUserId) {
    throw new Error("CANNOT_DELETE_SELF");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user || !companyId || user.companyId !== companyId) throw new Error("USER_NOT_FOUND");

  const role = (await fetchRolesByIds([user.roleId])).get(user.roleId);
  if (!role) throw new Error("USER_NOT_FOUND");

  if (!DELETABLE_ROLES.includes(role.systemRole as (typeof DELETABLE_ROLES)[number])) {
    throw new Error("ROLE_NOT_DELETABLE");
  }

  const supabase = createAdminClient();

  await prisma.$transaction(
    async (tx) => {
      const lockedUsers = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "users" WHERE id = ${user.id} FOR UPDATE
      `;
      if (lockedUsers.length === 0) throw new Error("USER_NOT_FOUND");

      if (role.systemRole === "DRIVER") {
        const activeRounds = await tx.round.count({
          where: { driverId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        });
        if (activeRounds > 0) {
          throw new Error("DRIVER_HAS_ACTIVE_DELIVERIES");
        }
      }

      // La FK met driverId à null sur les tournées passées.
      await tx.user.delete({ where: { id: user.id } });
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

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

