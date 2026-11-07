/**
 * ADM-1 (ADM-01) — l'administrateur modifie, désactive et réactive les comptes de son entreprise
 * (administrateur, boulanger, livreur, client). La création reste dans `user.service.ts` (invitation).
 *
 * Règles :
 * - compte d'une autre entreprise, ou super-administrateur : introuvable (404) ;
 * - un compte client (MERCHANT) est rattaché à un client de la même entreprise ; aucun autre rôle ne l'est ;
 * - on ne change pas son propre rôle et on ne se désactive pas soi-même ; l'entreprise garde toujours au
 *   moins un administrateur actif ;
 * - désactivé = statut INACTIVE : connexion refusée et chaque page ou appel d'API refusé dès la requête
 *   suivante (le statut est relu en base : `isAccountActive`). Réactivé : statut d'avant (un compte jamais
 *   activé reste en attente). Rien n'est supprimé ; chaque changement est journalisé (entité « User »).
 */
import type { Prisma, PrismaClient, SystemRole, UserStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { UpdateAccountInput } from "@/lib/validations/company-admin";

export type AccountAdminDb = Pick<PrismaClient, "user" | "role" | "merchant" | "auditLog">;
const defaultDb = () => prisma as unknown as AccountAdminDb;

const DEACTIVATED_FROM_KEY = "deactivatedFromStatus";
const MANAGEABLE: readonly SystemRole[] = ["ADMIN", "BAKER", "DRIVER", "MERCHANT"];

const notFound = () => new DomainRuleError(404, "Compte introuvable.", "USER_NOT_FOUND");

function settingsObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, Prisma.JsonValue>) } : {};
}

async function roleOf(db: AccountAdminDb, roleId: string) {
  const role = await db.role.findFirst({ where: { id: roleId } });
  if (!role) throw notFound();
  return role;
}

async function activeAdminCount(db: AccountAdminDb, companyId: string, adminRoleId: string) {
  return db.user.count({ where: { companyId, roleId: adminRoleId, status: "ACTIVE" } });
}

export interface AccountView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  role: { slug: string; systemRole: SystemRole; name: string };
  merchantId: string | null;
}

export async function updateCompanyAccount(
  actor: { companyId: string; userId: string },
  targetId: string,
  input: UpdateAccountInput,
  db: AccountAdminDb = defaultDb()
): Promise<AccountView> {
  const target = await db.user.findFirst({ where: { id: targetId, companyId: actor.companyId } });
  if (!target) throw notFound();
  const currentRole = await roleOf(db, target.roleId);
  if (!MANAGEABLE.includes(currentRole.systemRole)) throw notFound();
  const self = target.id === actor.userId;

  const nextRole = input.roleSlug ? await db.role.findFirst({ where: { slug: input.roleSlug } }) : currentRole;
  if (!nextRole || !MANAGEABLE.includes(nextRole.systemRole)) throw new DomainRuleError(400, "Rôle non autorisé.", "INVALID_ROLE");
  if (self && nextRole.id !== currentRole.id) throw new DomainRuleError(400, "Vous ne pouvez pas changer votre propre rôle.", "CANNOT_CHANGE_OWN_ROLE");
  if (self && input.active === false) throw new DomainRuleError(400, "Vous ne pouvez pas désactiver votre propre compte.", "CANNOT_DEACTIVATE_SELF");

  // Rattachement au client (compte client seulement).
  let merchantId: string | null = target.merchantId;
  if (nextRole.systemRole === "MERCHANT") {
    const wanted = input.merchantId !== undefined ? input.merchantId : target.merchantId;
    const merchant = wanted ? await db.merchant.findFirst({ where: { id: wanted, companyId: actor.companyId }, select: { id: true } }) : null;
    if (!merchant) throw new DomainRuleError(400, "Choisissez le client que ce compte représente.", "MERCHANT_REQUIRED");
    merchantId = merchant.id;
  } else {
    if (input.merchantId) throw new DomainRuleError(400, "Seul un compte client se rattache à un client.", "MERCHANT_NOT_ALLOWED");
    merchantId = null;
  }

  // Statut : désactivation ou réactivation.
  const settings = settingsObject(target.settings);
  let status: UserStatus = target.status;
  if (input.active === false && target.status !== "INACTIVE") {
    settings[DEACTIVATED_FROM_KEY] = target.status;
    status = "INACTIVE";
  } else if (input.active === true && target.status === "INACTIVE") {
    const previous = settings[DEACTIVATED_FROM_KEY];
    status = previous === "PENDING_VERIFICATION" ? "PENDING_VERIFICATION" : "ACTIVE";
    delete settings[DEACTIVATED_FROM_KEY];
  }

  // Toujours un administrateur actif dans l'entreprise.
  const losesAdmin = currentRole.systemRole === "ADMIN" && target.status === "ACTIVE" && (nextRole.systemRole !== "ADMIN" || status !== "ACTIVE");
  if (losesAdmin && (await activeAdminCount(db, actor.companyId, currentRole.id)) <= 1) {
    throw new DomainRuleError(409, "L'entreprise doit garder au moins un administrateur actif.", "LAST_ADMIN");
  }

  const data: Prisma.UserUncheckedUpdateManyInput = {
    roleId: nextRole.id,
    merchantId,
    status,
    settings: settings as Prisma.InputJsonValue,
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
  // Réclamation sur la version lue : deux enregistrements simultanés n'écrivent qu'une fois.
  const { count } = await db.user.updateMany({ where: { id: target.id, companyId: actor.companyId, updatedAt: target.updatedAt }, data });
  if (count === 0) throw new Error("SETTINGS_CONFLICT");
  const after = await db.user.findFirst({ where: { id: target.id, companyId: actor.companyId } });
  if (!after) throw notFound();

  const action = status === "INACTIVE" && target.status !== "INACTIVE" ? "DEACTIVATE" : target.status === "INACTIVE" && status !== "INACTIVE" ? "REACTIVATE" : "UPDATE";
  const view = (row: typeof target, role: typeof currentRole) => ({
    firstName: row.firstName, lastName: row.lastName, phone: row.phone, status: row.status, role: role.slug, merchantId: row.merchantId,
  });
  await db.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorId: actor.userId,
      entityType: "User",
      entityId: target.id,
      action,
      before: view(target, currentRole),
      after: view(after, nextRole),
    },
  });

  return {
    id: after.id,
    firstName: after.firstName,
    lastName: after.lastName,
    email: after.email,
    phone: after.phone,
    status: after.status,
    role: { slug: nextRole.slug, systemRole: nextRole.systemRole, name: nextRole.name },
    merchantId: after.merchantId,
  };
}
