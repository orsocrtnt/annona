import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/services/supabase/server";
import { getUserByAuthId } from "@/domains/user/user.service";
import { syncUserFromSupabase, UserNotProvisionedError } from "@/domains/auth/auth.service";
import { hasPermission } from "@/lib/permissions/rbac";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { resolveAuthUserWithDemoPersona } from "@/domains/demo/demo-auth.service";
import { isAccountActive, AccountUnavailableError } from "@/lib/auth/account-access";
import { isDemoLoginEmail } from "@/lib/demo/constants";
import { TUTELLIV_AUTH_ID_HEADER } from "@/lib/auth/auth-headers";

export interface ServerAuthContext {
  authId: string;
  user: UserWithRole;
  permissions: string[];
  isDemoSession: boolean;
}

async function resolveUserFromAuthId(
  authId: string,
  email?: string
): Promise<ServerAuthContext | null> {
  // Aucun cache inter-requêtes : une modification validée en base est relue
  // dès la prochaine requête, indépendamment de l'instance qui la reçoit.
  let user = await getUserByAuthId(authId);
  if (!user && email) {
    try {
      user = await syncUserFromSupabase({ authId, email });
    } catch (error) {
      if (error instanceof UserNotProvisionedError || error instanceof AccountUnavailableError) return null;
      throw error;
    }
  }
  if (!user || !isAccountActive(user)) return null;

  let resolved;
  try {
    resolved = await resolveAuthUserWithDemoPersona(authId, user);
  } catch (error) {
    if (error instanceof AccountUnavailableError) return null;
    throw error;
  }
  if (!isAccountActive(resolved.user)) return null;
  return {
    authId,
    user: resolved.user,
    permissions: resolved.permissions,
    isDemoSession: user.company?.isDemo === true && isDemoLoginEmail(user.email),
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

  if (!authUser || !authUser.email_confirmed_at) return null;

  return resolveUserFromAuthId(
    authUser.id,
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
