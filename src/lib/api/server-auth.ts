import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/services/supabase/server";
import { extractPermissionSlugs, getUserByAuthId } from "@/domains/user/user.service";
import { syncUserFromSupabase, UserNotProvisionedError } from "@/domains/auth/auth.service";
import { hasPermission } from "@/lib/permissions/rbac";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { resolveAuthUserWithDemoPersona } from "@/domains/demo/demo-auth.service";
import { getCachedAuth, loadAuthOnce } from "./auth-cache";
import { TUTELLIV_AUTH_ID_HEADER } from "@/lib/auth/auth-headers";

export interface ServerAuthContext {
  authId: string;
  user: UserWithRole;
  permissions: string[];
}

async function resolveUserFromAuthId(
  authId: string,
  metadata?: Record<string, string>,
  email?: string
): Promise<ServerAuthContext | null> {
  const cached = getCachedAuth(authId);
  if (cached) {
    if (!cached.user.company?.isDemo) {
      return {
        authId,
        user: cached.user,
        permissions: cached.permissions,
      };
    }
    const resolved = await resolveAuthUserWithDemoPersona(authId, cached.user);
    return {
      authId,
      user: resolved.user,
      permissions: resolved.permissions,
    };
  }

  const loaded = await loadAuthOnce(authId, async () => {
    let user = await getUserByAuthId(authId);

    if (!user && email) {
      const meta = metadata ?? {};
      const isCompanyAccount =
        meta.account_type === "company" || Boolean(meta.company_name);

      try {
        user = await syncUserFromSupabase({
          authId,
          email,
          firstName: meta.first_name ?? meta.firstName ?? "Utilisateur",
          lastName: meta.last_name ?? meta.lastName ?? "",
          accountType: isCompanyAccount ? "company" : undefined,
          companyName: meta.company_name,
        });
      } catch (error) {
        if (error instanceof UserNotProvisionedError) return null;
        throw error;
      }
    }

    if (!user) return null;
    return { user, permissions: extractPermissionSlugs(user) };
  });

  if (!loaded) return null;

  const resolved = await resolveAuthUserWithDemoPersona(authId, loaded.user);
  return {
    authId,
    user: resolved.user,
    permissions: resolved.permissions,
  };
}

/**
 * Charge le contexte auth une fois par requête.
 * Si le middleware a déjà validé l'utilisateur (header), on saute getUser().
 */
const loadAuthContext = cache(async (): Promise<ServerAuthContext | null> => {
  const headerList = await headers();
  const authIdFromMiddleware = headerList.get(TUTELLIV_AUTH_ID_HEADER);

  if (authIdFromMiddleware) {
    return resolveUserFromAuthId(authIdFromMiddleware);
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return resolveUserFromAuthId(
    authUser.id,
    authUser.user_metadata as Record<string, string>,
    authUser.email ?? undefined
  );
});

export async function getServerAuth(
  permissions?: PermissionSlug | PermissionSlug[]
): Promise<ServerAuthContext | null> {
  const auth = await loadAuthContext();
  if (!auth) return null;

  if (permissions && !hasPermission(auth.permissions, permissions)) {
    return null;
  }

  return auth;
}

export async function requireServerRole(role: SystemRole): Promise<ServerAuthContext | null> {
  const auth = await getServerAuth();
  if (!auth || auth.user.role.systemRole !== role) return null;
  return auth;
}
