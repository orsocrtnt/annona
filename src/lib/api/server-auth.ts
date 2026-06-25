import "server-only";
import { createClient } from "@/services/supabase/server";
import { extractPermissionSlugs, getUserByAuthId } from "@/domains/user/user.service";
import { syncUserFromSupabase, UserNotProvisionedError } from "@/domains/auth/auth.service";
import { hasPermission } from "@/lib/permissions/rbac";
import type { PermissionSlug } from "@/lib/permissions/rbac";
import type { SystemRole } from "@prisma/client";
import type { UserWithRole } from "@/types";
import { resolveAuthUserWithDemoPersona } from "@/domains/demo/demo-auth.service";
import { getCachedAuth, setCachedAuth } from "./auth-cache";

export interface ServerAuthContext {
  authId: string;
  user: UserWithRole;
  permissions: string[];
}

export async function getServerAuth(
  permissions?: PermissionSlug | PermissionSlug[]
): Promise<ServerAuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const cached = getCachedAuth(authUser.id);
  if (cached) {
    const resolved = await resolveAuthUserWithDemoPersona(authUser.id, cached.user);
    if (permissions && !hasPermission(resolved.permissions, permissions)) {
      return null;
    }
    return {
      authId: authUser.id,
      user: resolved.user,
      permissions: resolved.permissions,
    };
  }

  let user = await getUserByAuthId(authUser.id);

  if (!user) {
    const metadata = authUser.user_metadata as Record<string, string>;
    const isCompanyAccount =
      metadata.account_type === "company" || Boolean(metadata.company_name);

    try {
      user = await syncUserFromSupabase({
        authId: authUser.id,
        email: authUser.email!,
        firstName: metadata.first_name ?? metadata.firstName ?? "Utilisateur",
        lastName: metadata.last_name ?? metadata.lastName ?? "",
        accountType: isCompanyAccount ? "company" : undefined,
        companyName: metadata.company_name,
      });
    } catch (error) {
      if (error instanceof UserNotProvisionedError) return null;
      throw error;
    }
  }

  const resolved = await resolveAuthUserWithDemoPersona(authUser.id, user);
  setCachedAuth(authUser.id, user, extractPermissionSlugs(user));

  if (permissions && !hasPermission(resolved.permissions, permissions)) {
    return null;
  }

  return {
    authId: authUser.id,
    user: resolved.user,
    permissions: resolved.permissions,
  };
}

export async function requireServerRole(role: SystemRole): Promise<ServerAuthContext | null> {
  const auth = await getServerAuth();
  if (!auth || auth.user.role.systemRole !== role) return null;
  return auth;
}
