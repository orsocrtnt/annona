import { Prisma, type CompanyStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

/**
 * Couper ou rétablir l'accès d'un compte ou d'une entreprise depuis l'espace super admin (5 novembre 2026,
 * demande du propriétaire). Statut SUSPENDED : la connexion et chaque page ou appel relisent le statut en base
 * (`isAccountActive`), l'accès tombe donc en quelques secondes. Rien n'est supprimé ; « Rétablir » rend
 * le statut d'avant. Jamais un super admin ni un espace de démonstration.
 */
export type AccessAction = "suspend" | "restore";
export type AccessResult =
  | { ok: true; status: string }
  | { ok: false; code: "NOT_FOUND" | "PROTECTED" | "INVALID_STATE" };

const SUSPENDED_FROM_KEY = "platformSuspendedFromStatus";

function settingsObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, Prisma.JsonValue>) } : {};
}

export async function setPlatformUserAccess(id: string, action: AccessAction): Promise<AccessResult> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true, role: { select: { systemRole: true } }, company: { select: { isDemo: true } } },
  });
  if (!user) return { ok: false, code: "NOT_FOUND" };
  if (user.role.systemRole === "SUPER_ADMIN" || user.company?.isDemo) return { ok: false, code: "PROTECTED" };
  const [from, to] = action === "suspend" ? (["ACTIVE", "SUSPENDED"] as const) : (["SUSPENDED", "ACTIVE"] as const);
  if (user.status !== from) return { ok: false, code: "INVALID_STATE" };
  // Condition sur le statut lu : deux clics simultanés n'écrivent qu'une fois.
  const result = await prisma.user.updateMany({ where: { id, status: from }, data: { status: to } });
  return result.count === 1 ? { ok: true, status: to } : { ok: false, code: "INVALID_STATE" };
}

export async function setPlatformCompanyAccess(id: string, action: AccessAction): Promise<AccessResult> {
  const company = await prisma.company.findUnique({
    where: { id },
    select: { id: true, status: true, isDemo: true, settings: true },
  });
  if (!company) return { ok: false, code: "NOT_FOUND" };
  if (company.isDemo) return { ok: false, code: "PROTECTED" };
  const settings = settingsObject(company.settings);
  // Réclamation : les réglages lus n'ont pas changé entre la lecture et l'écriture (sinon aucune écriture).
  const expected = company.settings === null ? Prisma.DbNull : (company.settings as Prisma.InputJsonValue);
  if (action === "suspend") {
    if (company.status !== "ACTIVE" && company.status !== "TRIAL") return { ok: false, code: "INVALID_STATE" };
    settings[SUSPENDED_FROM_KEY] = company.status;
    const result = await prisma.company.updateMany({
      where: { id, status: company.status, settings: { equals: expected } },
      data: { status: "SUSPENDED", settings: settings as Prisma.InputJsonValue },
    });
    return result.count === 1 ? { ok: true, status: "SUSPENDED" } : { ok: false, code: "INVALID_STATE" };
  }
  if (company.status !== "SUSPENDED") return { ok: false, code: "INVALID_STATE" };
  const previous = settings[SUSPENDED_FROM_KEY];
  const restored: CompanyStatus = previous === "TRIAL" ? "TRIAL" : "ACTIVE";
  delete settings[SUSPENDED_FROM_KEY];
  const result = await prisma.company.updateMany({
    where: { id, status: "SUSPENDED", settings: { equals: expected } },
    data: { status: restored, settings: settings as Prisma.InputJsonValue },
  });
  return result.count === 1 ? { ok: true, status: restored } : { ok: false, code: "INVALID_STATE" };
}

export const ACCESS_ERROR_MESSAGES: Record<Exclude<AccessResult, { ok: true }>["code"], { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: "Compte introuvable." },
  PROTECTED: { status: 403, message: "Ce compte ne peut pas être coupé (super admin ou démonstration)." },
  INVALID_STATE: { status: 409, message: "Le statut a changé entre-temps : rechargez la page." },
};

export function parseAccessAction(body: unknown): AccessAction | null {
  const action = (body as { action?: unknown } | null)?.action;
  return action === "suspend" || action === "restore" ? action : null;
}
