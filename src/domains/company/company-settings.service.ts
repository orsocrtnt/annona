/**
 * ADM-1 (ADM-09, PLA-03, PLA-04, RG-01, NOT-01) — paramètres de l'entreprise réglés par son
 * administrateur : nom affiché dans les applications, heure limite, fuseau horaire, délai du rappel et
 * unités proposées à la saisie des produits (l'unité d'un produit reste libre). Le logo a son propre
 * service (`company-logo.service.ts`), les mentions légales le leur (Réglages › Facturation).
 *
 * Une nouvelle heure limite s'applique aux commandes encore ouvertes ; une date déjà verrouillée le reste.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { CompanySettingsInput } from "@/lib/validations/company-admin";

export type CompanySettingsDb = Pick<PrismaClient, "company" | "auditLog">;
const defaultDb = () => prisma as unknown as CompanySettingsDb;

export const DEFAULT_UNITS = ["pièce", "kg", "plaque", "lot de 10"] as const;

export interface CompanySettingsView {
  name: string;
  cutoffTime: string;
  timezone: string;
  reminderLeadMinutes: number;
  units: string[];
}

function settingsObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, Prisma.JsonValue>) } : {};
}

export function readUnits(settings: Prisma.JsonValue | null | undefined): string[] {
  const units = settingsObject(settings).units;
  return Array.isArray(units) && units.every((unit) => typeof unit === "string") ? (units as string[]) : [...DEFAULT_UNITS];
}

export async function getCompanySettings(companyId: string, db: CompanySettingsDb = defaultDb()): Promise<CompanySettingsView> {
  const company = await db.company.findFirst({ where: { id: companyId } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return {
    name: company.name,
    cutoffTime: company.cutoffTime,
    timezone: company.timezone,
    reminderLeadMinutes: company.reminderLeadMinutes,
    units: readUnits(company.settings),
  };
}

export async function updateCompanySettings(
  actor: { companyId: string; userId: string | null },
  input: CompanySettingsInput,
  db: CompanySettingsDb = defaultDb()
): Promise<CompanySettingsView> {
  const company = await db.company.findFirst({ where: { id: actor.companyId } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  const before = await getCompanySettings(actor.companyId, db);
  const data: Prisma.CompanyUpdateManyMutationInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.cutoffTime !== undefined) data.cutoffTime = input.cutoffTime;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.reminderLeadMinutes !== undefined) data.reminderLeadMinutes = input.reminderLeadMinutes;
  if (input.units !== undefined) {
    const units = [...new Set(input.units.map((unit) => unit.trim()).filter(Boolean))];
    // Réclamation : la ligne n'a pas changé depuis la lecture (les autres réglages JSON sont gardés).
    data.settings = { ...settingsObject(company.settings), units } as Prisma.InputJsonValue;
  }
  const { count } = await db.company.updateMany({ where: { id: actor.companyId, updatedAt: company.updatedAt }, data });
  if (count === 0) throw new Error("SETTINGS_CONFLICT");
  const after = await getCompanySettings(actor.companyId, db);
  await db.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorId: actor.userId,
      entityType: "CompanySettings",
      entityId: actor.companyId,
      action: "UPDATE",
      before: before as unknown as Prisma.InputJsonObject,
      after: after as unknown as Prisma.InputJsonObject,
    },
  });
  return after;
}
