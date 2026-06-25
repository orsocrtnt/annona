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

export interface DemoSessionInfo {
  isDemo: true;
  persona: DemoPersona;
  loginEmail: string;
}

export async function getDemoBaseAuthUser(): Promise<UserWithRole | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const user = await getUserByAuthId(authUser.id);
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
