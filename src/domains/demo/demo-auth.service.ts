import "server-only";
import { createClient } from "@/services/supabase/server";
import { getUserByAuthId } from "@/domains/user/user.service";
import { extractPermissionSlugs } from "@/domains/user/user.service";
import type { UserWithRole } from "@/types";
import {
  isDemoLoginEmail,
  type DemoPersona,
} from "@/lib/demo/constants";
import { getDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { getDemoPersonaUser } from "@/domains/demo/demo-users.service";
import { getCachedAuth } from "@/lib/api/auth-cache";

export interface DemoSessionInfo {
  isDemo: true;
  persona: DemoPersona;
  loginEmail: string;
}

/**
 * @param knownAuthId — si déjà connu (ex. après getServerAuth), évite un 2e getUser()
 */
export async function getDemoBaseAuthUser(
  knownAuthId?: string
): Promise<UserWithRole | null> {
  let authId = knownAuthId;
  if (!authId) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;
    authId = authUser.id;
  }

  // Réutilise le cache posé par getServerAuth dans la même requête
  const cached = getCachedAuth(authId);
  const user = cached?.user ?? (await getUserByAuthId(authId));
  if (!user?.company?.isDemo || !isDemoLoginEmail(user.email)) return null;
  return user;
}

export async function resolveDemoActiveUser(
  baseUser: UserWithRole,
  persona?: DemoPersona
): Promise<UserWithRole | null> {
  if (!baseUser.companyId || !baseUser.company?.isDemo) return baseUser;

  const activePersona = persona ?? (await getDemoPersonaCookie());
  const personaUser = await getDemoPersonaUser(baseUser.companyId, activePersona);
  return personaUser ?? baseUser;
}

export async function resolveAuthUserWithDemoPersona(
  authId: string,
  baseUser: UserWithRole
): Promise<{ user: UserWithRole; permissions: string[] }> {
  if (!baseUser.company?.isDemo || !isDemoLoginEmail(baseUser.email)) {
    return {
      user: baseUser,
      permissions: extractPermissionSlugs(baseUser),
    };
  }

  const personaUser = await resolveDemoActiveUser(baseUser);
  const user = personaUser ?? baseUser;
  return {
    user,
    permissions: extractPermissionSlugs(user),
  };
}
