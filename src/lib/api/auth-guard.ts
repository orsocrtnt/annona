import "server-only";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions/rbac";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { getServerAuth } from "./server-auth";

interface AuthContext {
  authId: string;
  user: UserWithRole;
  permissions: string[];
}

export async function requireAuth(
  permissions?: PermissionSlug | PermissionSlug[]
): Promise<{ context: AuthContext } | { error: NextResponse }> {
  const auth = await getServerAuth();

  if (!auth) {
    return {
      error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  if (permissions && !hasPermission(auth.permissions, permissions)) {
    return {
      error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
  }

  return { context: auth };
}

export async function requireClientRole(): Promise<
  { context: AuthContext } | { error: NextResponse }
> {
  const result = await requireAuth("dashboard:client");
  if ("error" in result) return result;

  if (result.context.user.role.systemRole !== "CLIENT") {
    return {
      error: NextResponse.json({ error: "Réservé aux clients" }, { status: 403 }),
    };
  }

  return result;
}

export async function requireDriverRole(): Promise<
  { context: AuthContext } | { error: NextResponse }
> {
  const result = await requireAuth("dashboard:driver");
  if ("error" in result) return result;

  if (result.context.user.role.systemRole !== "DRIVER") {
    return {
      error: NextResponse.json({ error: "Réservé aux chauffeurs" }, { status: 403 }),
    };
  }

  return result;
}

/** Rôles internes à une entreprise (back-office). Exclut CLIENT et DRIVER. */
const STAFF_ROLES: SystemRole[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"];

/**
 * Garde des routes back-office : exige la permission ET un rôle personnel
 * (SUPER_ADMIN / COMPANY_ADMIN / DISPATCHER). Empêche un CLIENT ou un DRIVER
 * d'atteindre les routes d'administration même s'il partage une permission.
 */
export async function requireStaffRole(
  permissions?: PermissionSlug | PermissionSlug[]
): Promise<{ context: AuthContext } | { error: NextResponse }> {
  const result = await requireAuth(permissions);
  if ("error" in result) return result;

  if (!STAFF_ROLES.includes(result.context.user.role.systemRole)) {
    return {
      error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
  }

  return result;
}

export function getCompanyId(context: AuthContext): string | null {
  return context.user.companyId ?? null;
}

export function requireRole(
  context: AuthContext,
  roles: SystemRole[]
): NextResponse | null {
  if (!roles.includes(context.user.role.systemRole)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return null;
}
