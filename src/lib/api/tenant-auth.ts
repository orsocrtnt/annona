import "server-only";
import { NextResponse } from "next/server";
import { requireAuth, requireMerchantRole } from "@/lib/api/auth-guard";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { UserWithRole } from "@/types";

/**
 * Gardes des API métier de l'entreprise (CAT-1, CMD-1). L'entreprise vient toujours de la session,
 * jamais de la requête (PLA-01) ; le commerçant d'un compte client vient de son utilisateur.
 */
export interface CompanyActor {
  user: UserWithRole;
  permissions: string[];
  companyId: string;
}

export interface MerchantActor extends CompanyActor {
  merchantId: string;
}

type Guarded<T> = { actor: T } | { error: NextResponse };

const json = (error: string, status: number) => NextResponse.json({ error, success: false }, { status });

/** Administrateur de l'entreprise (seul rôle qui gère le catalogue et les prix : ADM-02, ADM-03). */
export async function requireCompanyAdmin(permission: PermissionSlug): Promise<Guarded<CompanyActor>> {
  const auth = await requireAuth(permission);
  if ("error" in auth) return auth;
  const { user, permissions } = auth.context;
  if (user.role.systemRole !== "ADMIN") return { error: json("Accès refusé", 403) };
  if (!user.companyId) return { error: json("Entreprise non associée", 403) };
  return { actor: { user, permissions, companyId: user.companyId } };
}

/** Utilisateur de l'entreprise ayant la permission (lecture partagée, ex. photo d'un produit). */
export async function requireCompanyMember(permission: PermissionSlug): Promise<Guarded<CompanyActor>> {
  const auth = await requireAuth(permission);
  if ("error" in auth) return auth;
  const { user, permissions } = auth.context;
  if (!user.companyId) return { error: json("Entreprise non associée", 403) };
  return { actor: { user, permissions, companyId: user.companyId } };
}

/** Compte client (MERCHANT) rattaché à un commerçant de son entreprise. */
export async function requireMerchantActor(): Promise<Guarded<MerchantActor>> {
  const auth = await requireMerchantRole();
  if ("error" in auth) return auth;
  const { user, permissions } = auth.context;
  if (!user.companyId) return { error: json("Entreprise non associée", 403) };
  if (!user.merchantId) return { error: json("Compte client non rattaché à un commerce. Contactez la boulangerie.", 403) };
  return { actor: { user, permissions, companyId: user.companyId, merchantId: user.merchantId } };
}
