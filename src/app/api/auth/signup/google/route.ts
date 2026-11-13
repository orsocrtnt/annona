import { NextResponse } from "next/server";
import { zodIssueMessage } from "@/lib/config-messages";
import { companySignupSchema } from "@/lib/validations/auth";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { prisma } from "@/services/prisma/client";
import { createClient } from "@/services/supabase/server";
import { signUpCompanyWithGoogle } from "@/domains/auth/company-signup.service";
import { sessionIdentity } from "@/domains/auth/supabase-signup";
import { syncUserFromSupabase, getDashboardPathForRole } from "@/domains/auth/auth.service";
import { extractPermissionSlugs } from "@/domains/user/user.service";
import type { CompanyAdminDb } from "@/domains/admin/company-admin.service";

/**
 * AUTH-GOOGLE : fin de l'inscription après « Continuer avec Google ». L'adresse et l'identifiant viennent
 * de la session Supabase relue ici, jamais du navigateur ; seul le nom de la boulangerie est saisi.
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const parsed = companySignupSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      return NextResponse.json({ error: "Session Google expirée. Reprenez l'inscription avec Google." }, { status: 401 });
    }
    const identity = sessionIdentity(authUser);
    await signUpCompanyWithGoogle(parsed.data, identity, { db: prisma as unknown as CompanyAdminDb });
    const user = await syncUserFromSupabase({ authId: identity.authId, email: identity.email });
    return NextResponse.json(
      { user, permissions: extractPermissionSlugs(user), redirectTo: getDashboardPathForRole(user.role.systemRole) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  });
}
