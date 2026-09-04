import { createAdminClient } from "@/services/supabase/admin";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import {
  syncUserFromSupabase,
  getDashboardPathForRole,
} from "@/domains/auth/auth.service";
import { getUserPermissions } from "@/domains/user/user.service";
import type { UserWithRole } from "@/types";

interface ProvisionCompanyAdminInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

async function findSupabaseUserByEmail(email: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

export async function provisionCompanyAdmin(
  input: ProvisionCompanyAdminInput
): Promise<{
  user: UserWithRole;
  permissions: string[];
  redirectTo: string;
  authId: string;
}> {
  const normalizedEmail = normalizeEmail(input.email);
  const supabase = createAdminClient();

  const existing = await findSupabaseUserByEmail(normalizedEmail);
  if (existing) {
    // Sécurité : on ne réécrit jamais le mot de passe d'un compte existant.
    throw new Error(
      "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe."
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      company_name: input.companyName ?? "",
      account_type: "company",
    },
  });
  if (error || !data.user) throw new Error(error?.message ?? "SUPABASE_CREATE_FAILED");
  const authUser = data.user;

  const user = await syncUserFromSupabase({
    authId: authUser.id,
    email: normalizedEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    accountType: "company",
    companyName: input.companyName,
  });

  const permissions = await getUserPermissions(authUser.id);

  return {
    user,
    permissions,
    redirectTo: getDashboardPathForRole(user.role.systemRole, user.settings),
    authId: authUser.id,
  };
}
