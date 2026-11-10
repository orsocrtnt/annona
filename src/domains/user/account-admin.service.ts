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
 * - lot 1, demande 4 : seul un administrateur complet crée, modifie, désactive un compte administrateur ou
 *   mini admin et choisit ses fonctionnalités (`settings.miniAdmin.modules`) ; un mini admin qui a la
 *   fonctionnalité « comptes » ne gère que les comptes clients, boulangers et livreurs. On ne change pas
 *   ses propres fonctionnalités ; l'entreprise garde toujours au moins un administrateur complet actif.
 */
import type { Prisma, PrismaClient, SystemRole, UserStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { UpdateAccountInput } from "@/lib/validations/company-admin";
import { miniAdminModules, withMiniAdminModules, type MiniAdminModuleId } from "@/lib/permissions/mini-admin";

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

/** Administrateurs complets actifs (les mini admins ne comptent pas : ils ne gèrent pas les administrateurs). */
async function activeFullAdminCount(db: AccountAdminDb, companyId: string, adminRoleId: string) {
  const admins = await db.user.findMany({ where: { companyId, roleId: adminRoleId, status: "ACTIVE" }, select: { id: true, settings: true } });
  return admins.filter((admin) => miniAdminModules({ settings: admin.settings, role: { systemRole: "ADMIN" } }) === null).length;
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
  /** Lot 1, demande 4 : fonctionnalités d'un mini admin ; `null` = accès complet du rôle. */
  miniAdminModules: MiniAdminModuleId[] | null;
}

export async function updateCompanyAccount(
  actor: { companyId: string; userId: string; /** Administrateur complet (pas mini admin) ; vrai par défaut. */ fullAdmin?: boolean },
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

  // Lot 1, demande 4 : comptes administrateur et mini admin réservés à un administrateur complet.
  const touchesAdmin = currentRole.systemRole === "ADMIN" || nextRole.systemRole === "ADMIN" || input.miniAdminModules !== undefined;
  if (touchesAdmin && actor.fullAdmin === false) {
    throw new DomainRuleError(403, "Seul un administrateur peut créer, modifier ou désactiver un compte administrateur ou mini admin.", "ADMIN_ONLY");
  }
  if (input.miniAdminModules !== undefined && nextRole.systemRole !== "ADMIN" && input.miniAdminModules !== null) {
    throw new DomainRuleError(400, "Seul un compte administrateur peut être un mini admin.", "MINI_ADMIN_ROLE");
  }
  const beforeModules = miniAdminModules({ settings: target.settings, role: currentRole });
  if (self && input.miniAdminModules !== undefined && JSON.stringify(input.miniAdminModules) !== JSON.stringify(beforeModules)) {
    throw new DomainRuleError(400, "Vous ne pouvez pas changer vos propres fonctionnalités.", "CANNOT_CHANGE_OWN_MODULES");
  }

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

  // Statut : désactivation ou réactivation. Fonctionnalités : seulement pour un administrateur.
  const nextModules = nextRole.systemRole !== "ADMIN" ? null : input.miniAdminModules !== undefined ? input.miniAdminModules : beforeModules;
  const settings = settingsObject(withMiniAdminModules(target.settings, nextModules) as Prisma.JsonValue);
  let status: UserStatus = target.status;
  if (input.active === false && target.status !== "INACTIVE") {
    settings[DEACTIVATED_FROM_KEY] = target.status;
    status = "INACTIVE";
  } else if (input.active === true && target.status === "INACTIVE") {
    const previous = settings[DEACTIVATED_FROM_KEY];
    status = previous === "PENDING_VERIFICATION" ? "PENDING_VERIFICATION" : "ACTIVE";
    delete settings[DEACTIVATED_FROM_KEY];
  }

  // Toujours un administrateur complet actif dans l'entreprise (lot 1, demande 4 : un mini admin ne compte pas).
  const wasFullAdmin = currentRole.systemRole === "ADMIN" && beforeModules === null && target.status === "ACTIVE";
  const staysFullAdmin = nextRole.systemRole === "ADMIN" && nextModules === null && status === "ACTIVE";
  if (wasFullAdmin && !staysFullAdmin && (await activeFullAdminCount(db, actor.companyId, currentRole.id)) <= 1) {
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
    miniAdminModules: miniAdminModules({ settings: row.settings, role }),
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
    miniAdminModules: miniAdminModules({ settings: after.settings, role: nextRole }),
  };
}
