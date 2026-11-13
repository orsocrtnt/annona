import { AccountUnavailableError, assertAccountActive, isAccountActive } from "@/lib/auth/account-access";
import { prisma } from "@/services/prisma/client";
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

/**
 * Compte « en attente » dont l'adresse vient d'être prouvée (connexion Google de même adresse, lien de
 * confirmation d'une inscription, AUTH-GOOGLE) : il devient actif, sauf si l'entreprise est indisponible.
 */
export function shouldActivatePending(user: UserWithRole, activatePending: boolean): boolean {
  return activatePending && user.status === "PENDING_VERIFICATION" && isAccountActive({ ...user, status: "ACTIVE" });
}

export async function syncUserFromSupabase(
  input: SyncUserInput,
  options: { activatePending?: boolean } = {}
): Promise<UserWithRole> {
  const email = normalizeEmail(input.email);

  const existing = await getUserByAuthId(input.authId);

  if (existing) {
    const activate = shouldActivatePending(existing, options.activatePending === true);
    const hydrated = activate ? { ...existing, status: "ACTIVE" as const } : existing;
    assertAccountActive(hydrated);
    await prisma.user.update({
      where: { id: existing.id },
      data: { lastLoginAt: new Date(), ...(activate ? { status: "ACTIVE" as const } : {}) },
    });
    return hydrated;
  }

  const existingByEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { company: true },
  });

  if (existingByEmail) {
    assertAccountActive(await hydrateUserWithRole(existingByEmail));
    // Un profil déjà lié à un autre compte de connexion n'est jamais repris par l'adresse seule : un
    // compte invité garde son identifiant dès l'invitation et passe par la recherche ci-dessus (AUDIT-0111, S5).
    if (existingByEmail.authId !== input.authId) throw new AccountUnavailableError();
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
    return hydrateUserWithRole(user);
  }

  // Aucun provisionnement à partir des métadonnées Supabase, modifiables par
  // l'utilisateur : une entreprise et ses comptes ne naissent que du back-office
  // (éditeur de la plateforme, puis administrateur de l'entreprise).
  throw new UserNotProvisionedError();
}

/**
 * Connexion Google d'un compte créé par l'admin et jamais activé, quand Supabase a ouvert un compte de
 * connexion distinct pour la même adresse (AUTH-GOOGLE) : le profil « en attente » est rattaché au compte
 * Google, qui prouve l'adresse. Un profil actif n'est jamais repris (AUDIT-0111, S5).
 */
export async function adoptPendingProfile(input: SyncUserInput): Promise<{ previousAuthId: string | null } | null> {
  const profile = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(input.email), mode: "insensitive" } },
    select: { id: true, authId: true, status: true },
  });
  if (!profile || profile.status !== "PENDING_VERIFICATION" || profile.authId === input.authId) return null;
  await prisma.user.update({ where: { id: profile.id }, data: { authId: input.authId } });
  return { previousAuthId: profile.authId };
}

export function getDashboardPathForRole(role: SystemRole): string {
  return getRoleHomePath(role);
}
