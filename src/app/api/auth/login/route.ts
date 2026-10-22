import { after, NextResponse } from "next/server";
import { assertAccountActive, AccountUnavailableError } from "@/lib/auth/account-access";
import { loginSchema } from "@/lib/validations/auth";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { createClient } from "@/services/supabase/server";
import {
  syncUserFromSupabase,
  getDashboardPathForRole,
  UserNotProvisionedError,
} from "@/domains/auth/auth.service";
import type { AccountType } from "@/domains/auth/auth.service";
import {
  extractPermissionSlugs,
  getUserByAuthId,
  updateLastLogin,
} from "@/domains/user/user.service";
import { isDemoLoginEmail, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { setDemoPersonaCookie } from "@/lib/demo/persona-cookie";
import { resolveDemoActiveUser } from "@/domains/demo/demo-auth.service";
import { ensureDemoSessionForLogin } from "@/domains/demo/demo-session.service";
import {
  DemoPoolUnavailableError,
  maintainDemoPool,
  recycleDemoPoolEnvironment,
  requestDemoPoolRecycle,
} from "@/domains/demo/demo-pool.service";

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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (signInError || !signInData.user?.email) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const authUser = signInData.user;
    if (!authUser.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Confirmez votre adresse e-mail avant de vous connecter." }, { status: 403 });
    }
    const metadata = authUser.user_metadata as Record<string, string>;
    const resolvedAccountType =
      accountType ??
      (metadata.account_type as AccountType | undefined) ??
      (metadata.company_name ? "company" : undefined);

    const isDemoAccount = isDemoLoginEmail(authUser.email!);
    const requestKey = typeof (body as { demoRequestKey?: unknown }).demoRequestKey === "string"
      ? (body as { demoRequestKey: string }).demoRequestKey
      : undefined;
    let sessionCompanyId: string | undefined;
    let user: Awaited<ReturnType<typeof syncUserFromSupabase>>;

    if (isDemoAccount) {
      // Après authentification Supabase, la lecture du compte permanent et la
      // réservation atomique sont indépendantes : les exécuter ensemble retire
      // une attente réseau du chemin critique.
      const [baseUser, leasedCompanyId] = await Promise.all([
        getUserByAuthId(authUser.id),
        ensureDemoSessionForLogin("authenticated-demo", requestKey),
      ]);
      if (!baseUser) throw new UserNotProvisionedError();
      user = baseUser;
      sessionCompanyId = leasedCompanyId;
    } else {
      user = await syncUserFromSupabase({
        authId: authUser.id,
        email: authUser.email!,
        firstName: metadata.first_name ?? metadata.firstName ?? "Utilisateur",
        lastName: metadata.last_name ?? metadata.lastName ?? "",
        accountType: resolvedAccountType,
        companyName: metadata.company_name,
      });
    }

    assertAccountActive(user);

    if (isDemoAccount) {
      // La connexion reprend la démo ; seule l'action explicite de l'utilisateur
      // peut réinitialiser ses données. Aucun seed ni reconstruction au login.
      if (!user.companyId || !user.company?.isDemo) {
        if (sessionCompanyId && await requestDemoPoolRecycle(sessionCompanyId)) {
          after(async () => { await recycleDemoPoolEnvironment(sessionCompanyId!); });
        }
        return NextResponse.json(
          { error: "Environnement de démo incomplet. Contactez votre administrateur." },
          { status: 503 }
        );
      }

      after(async () => {
        const results = await Promise.allSettled([
          updateLastLogin(user.id),
          maintainDemoPool(),
        ]);
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Demo post-login maintenance failed:", result.reason);
          }
        }
      });
      await setDemoPersonaCookie("admin");
      const personaUser = await resolveDemoActiveUser(user, "admin", sessionCompanyId!);
      if (personaUser) user = personaUser;
    }

    assertAccountActive(user);
    const permissions = extractPermissionSlugs(user);

    return NextResponse.json({
      user,
      permissions,
      redirectTo: getDashboardPathForRole(user.role.systemRole, user.settings),
      demo: isDemoAccount
        ? {
            isDemo: true as const,
            persona: "admin" as const,
            loginEmail: DEMO_LOGIN_EMAIL,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof DemoPoolUnavailableError) {
      after(async () => {
        try {
          await maintainDemoPool();
        } catch (maintenanceError) {
          console.error("Demo pool recovery failed:", maintenanceError);
        }
      });
      return NextResponse.json(
        {
          error: "Tous les espaces de démonstration sont occupés ou en préparation. Réessayez dans quelques secondes.",
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 503,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    if (error instanceof AccountUnavailableError) {
      return NextResponse.json({ error: "Compte ou entreprise indisponible. Contactez votre administrateur." }, { status: 403 });
    }
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
