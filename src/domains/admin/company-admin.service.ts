/**
 * ADM-1 (PLA-02) — le super-administrateur crée une entreprise avec son premier administrateur, puis la
 * configure (nom, heure limite, fuseau, délai du rappel). La suspension et la réactivation sont dans
 * `account-access.service.ts` (statut SUSPENDED : plus aucun accès pour ses utilisateurs).
 *
 * Le super-administrateur n'ouvre jamais les opérations courantes de l'entreprise (commandes, clients) :
 * ce service ne lit ni n'écrit que la ligne `companies`, ses créneaux par défaut et le compte invité.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { ConfigureCompanyInput, CreateCompanyInput } from "@/lib/validations/company-admin";

export type CompanyAdminDb = Pick<PrismaClient, "company" | "slot" | "user" | "role" | "$transaction">;
const defaultDb = () => prisma as unknown as CompanyAdminDb;

/** Créneaux de départ (ACCES-1, en attendant la réponse du premier client) : modifiables ensuite. */
export const DEFAULT_SLOTS = [
  { startTime: "05:00", endTime: "06:00" },
  { startTime: "06:00", endTime: "07:00" },
  { startTime: "07:00", endTime: "08:00" },
] as const;

export interface InvitedAccount {
  authId: string;
  /** Faux : invitations non configurées, compte créé en attente (sans mot de passe). */
  invited: boolean;
}

export interface AuthInviter {
  invite(email: string, metadata: { first_name: string; last_name: string }): Promise<InvitedAccount>;
  remove(authId: string): Promise<void>;
}

/** Invitation Supabase Auth, comme pour les comptes créés par un administrateur (domaine utilisateur). */
export const supabaseInviter: AuthInviter = {
  async invite(email, metadata) {
    const { inviteAuthUser } = await import("@/domains/user/user.service");
    return inviteAuthUser(email, metadata);
  },
  async remove(authId) {
    const { removeAuthUser } = await import("@/domains/user/user.service");
    await removeAuthUser(authId);
  },
};

export function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "entreprise";
}

async function uniqueSlug(db: CompanyAdminDb, name: string) {
  const base = slugify(name);
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    if (!(await db.company.findFirst({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new DomainRuleError(409, "Nom d'entreprise déjà utilisé.", "COMPANY_SLUG_TAKEN");
}

/** Contrôles communs avant de créer une entreprise : adresse libre, rôle admin présent, identifiant unique. */
export async function prepareCompanyCreation(db: CompanyAdminDb, name: string, adminEmail: string) {
  if (await db.user.findFirst({ where: { email: adminEmail }, select: { id: true } })) {
    throw new DomainRuleError(409, "Cet e-mail est déjà utilisé par un compte.", "EMAIL_EXISTS");
  }
  const role = await db.role.findFirst({ where: { slug: "admin" } });
  if (!role) throw new Error("ROLE_NOT_FOUND");
  const slug = await uniqueSlug(db, name);
  return { roleId: role.id, slug };
}

export interface NewCompanyRecords {
  name: string;
  slug: string;
  roleId: string;
  /** ACTIVE par le super admin (PLA-02) ; TRIAL pour une inscription autonome (AUTH-GOOGLE). */
  companyStatus: "ACTIVE" | "TRIAL";
  cutoffTime: string;
  timezone: string;
  reminderLeadMinutes: number;
  admin: { firstName: string; lastName: string; email: string };
  authId: string;
  userStatus: "ACTIVE" | "PENDING_VERIFICATION";
}

/** Entreprise, créneaux par défaut et premier administrateur, en une seule transaction. */
export async function insertCompanyWithAdmin(db: CompanyAdminDb, input: NewCompanyRecords) {
  return db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        slug: input.slug,
        status: input.companyStatus,
        cutoffTime: input.cutoffTime,
        timezone: input.timezone,
        reminderLeadMinutes: input.reminderLeadMinutes,
        settings: {},
      },
    });
    await tx.slot.createMany({
      data: DEFAULT_SLOTS.map((slot, index) => ({ companyId: company.id, startTime: slot.startTime, endTime: slot.endTime, active: true, sortOrder: index })),
    });
    const user = await tx.user.create({
      data: {
        authId: input.authId,
        email: input.admin.email,
        firstName: input.admin.firstName,
        lastName: input.admin.lastName,
        roleId: input.roleId,
        companyId: company.id,
        status: input.userStatus,
      },
    });
    return { companyId: company.id, adminUserId: user.id };
  });
}

export async function createCompanyWithAdmin(
  input: CreateCompanyInput,
  deps: { db?: CompanyAdminDb; inviter?: AuthInviter } = {}
): Promise<{ companyId: string; adminUserId: string; invited: boolean }> {
  const db = deps.db ?? defaultDb();
  const inviter = deps.inviter ?? supabaseInviter;
  const { roleId, slug } = await prepareCompanyCreation(db, input.name, input.admin.email);

  let account: InvitedAccount;
  try {
    account = await inviter.invite(input.admin.email, { first_name: input.admin.firstName, last_name: input.admin.lastName });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVITATION_FAILED";
    if (code === "EMAIL_EXISTS") throw new DomainRuleError(409, "Cet e-mail est déjà utilisé par un compte.", "EMAIL_EXISTS");
    if (code === "AUTH_RATE_LIMITED") throw new DomainRuleError(429, "Trop d'invitations envoyées. Réessayez plus tard.", "AUTH_RATE_LIMITED");
    throw new DomainRuleError(502, "L'invitation n'a pas pu être envoyée. Réessayez.", "INVITATION_FAILED");
  }

  try {
    const created = await insertCompanyWithAdmin(db, {
      name: input.name,
      slug,
      roleId,
      companyStatus: "ACTIVE",
      cutoffTime: input.cutoffTime,
      timezone: input.timezone,
      reminderLeadMinutes: input.reminderLeadMinutes,
      admin: input.admin,
      authId: account.authId,
      userStatus: "PENDING_VERIFICATION",
    });
    return { ...created, invited: account.invited };
  } catch (error) {
    // Aucune entreprise à moitié créée : le compte d'authentification est retiré.
    await inviter.remove(account.authId).catch(() => undefined);
    throw error;
  }
}

export interface CompanyConfig {
  id: string;
  name: string;
  cutoffTime: string;
  timezone: string;
  reminderLeadMinutes: number;
  status: string;
}

export async function getCompanyConfig(companyId: string, db: Pick<PrismaClient, "company"> = prisma): Promise<CompanyConfig> {
  const company = await db.company.findFirst({
    where: { id: companyId },
    select: { id: true, name: true, cutoffTime: true, timezone: true, reminderLeadMinutes: true, status: true },
  });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company;
}

export async function configureCompany(companyId: string, input: ConfigureCompanyInput, db: Pick<PrismaClient, "company"> = prisma): Promise<CompanyConfig> {
  await getCompanyConfig(companyId, db);
  await db.company.updateMany({ where: { id: companyId }, data: input });
  return getCompanyConfig(companyId, db);
}
