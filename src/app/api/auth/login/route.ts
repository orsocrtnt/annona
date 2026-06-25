import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import {
  syncUserFromSupabase,
  getDashboardPathForRole,
  UserNotProvisionedError,
} from "@/domains/auth/auth.service";
import type { AccountType } from "@/domains/auth/auth.service";
import { extractPermissionSlugs } from "@/domains/user/user.service";
import { isDemoLoginEmail, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { setDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { resolveDemoActiveUser } from "@/domains/demo/demo-auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    const accountType = (body as { accountType?: AccountType }).accountType;

    const supabase = await createClient();

    let { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (signInError) {
      const code = (signInError as { code?: string }).code;
      if (code === "email_not_confirmed") {
        const admin = createAdminClient();
        const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const authUser = listed?.users.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (authUser) {
          await admin.auth.admin.updateUserById(authUser.id, {
            email_confirm: true,
          });
          ({ data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            }));
        }
      }
    }

    if (signInError || !signInData.user?.email) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const authUser = signInData.user;
    const metadata = authUser.user_metadata as Record<string, string>;
    const resolvedAccountType =
      accountType ??
      (metadata.account_type as AccountType | undefined) ??
      (metadata.company_name ? "company" : undefined);

    let user = await syncUserFromSupabase({
      authId: authUser.id,
      email: authUser.email!,
      firstName: metadata.first_name ?? metadata.firstName ?? "Utilisateur",
      lastName: metadata.last_name ?? metadata.lastName ?? "",
      accountType: resolvedAccountType,
      companyName: metadata.company_name,
    });

    const isDemoAccount = isDemoLoginEmail(authUser.email!);

    if (isDemoAccount) {
      await setDemoPersonaCookie("admin");
      const personaUser = await resolveDemoActiveUser(user, "admin");
      if (personaUser) user = personaUser;
    }

    const permissions = extractPermissionSlugs(user);

    return NextResponse.json({
      user,
      permissions,
      redirectTo: getDashboardPathForRole(user.role.systemRole),
      demo: isDemoAccount
        ? {
            isDemo: true as const,
            persona: "admin" as const,
            loginEmail: DEMO_LOGIN_EMAIL,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof UserNotProvisionedError) {
      return NextResponse.json(
        {
          error:
            "Votre compte n'a pas été activé. Contactez votre administrateur pour obtenir vos identifiants.",
        },
        { status: 403 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}
