import { assertAccountActive } from "@/lib/auth/account-access";
import { prisma } from "@/services/prisma/client";
import { linkPortalDataToClient } from "@/domains/client-portal/client-data.service";
import { hydrateUserWithRole, getUserByAuthId } from "@/domains/user/user.service";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { getRoleHomePath } from "@/lib/permissions/page-access";

/** Prénom et nom ne sont jamais lus depuis user_metadata, modifiable par l'utilisateur. */
interface SyncUserInput {
  authId: string;
  email: string;
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
      // Rattachement initial du compte préparé (invitation, import) : l'identité saisie
      // par l'administrateur est conservée.
      data: {
        authId: input.authId,
        email,
        lastLoginAt: new Date(),
      },
      include: { company: true },
    });
    await linkPortalDataToClient(user.id, email, user.companyId);
    return hydrateUserWithRole(user);
  }

  // Aucun provisionnement à partir des métadonnées Supabase, modifiables par
  // l'utilisateur : une entreprise et son abonnement ne naissent que du parcours
  // d'inscription vérifié côté serveur (SignupJourney), de la démo ou du back-office.
  throw new UserNotProvisionedError();
}

export function getDashboardPathForRole(role: SystemRole, settings?: unknown): string {
  return getRoleHomePath(role, settings);
}
