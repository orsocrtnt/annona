import { resolveOnboardingLoginPath } from "@/domains/onboarding/onboarding.service";
import { NextResponse } from "next/server";
import { assertAccountActive, AccountUnavailableError } from "@/lib/auth/account-access";
import { createClient } from "@/services/supabase/server";
import {
  syncUserFromSupabase,
  getDashboardPathForRole,
  UserNotProvisionedError,
} from "@/domains/auth/auth.service";
import { getUserPermissions } from "@/domains/user/user.service";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.email || !authUser.email_confirmed_at) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const metadata = authUser.user_metadata as Record<string, string>;
    const user = await syncUserFromSupabase({
      authId: authUser.id,
      email: authUser.email,
      firstName: metadata.first_name ?? metadata.firstName ?? "Utilisateur",
      lastName: metadata.last_name ?? metadata.lastName ?? "",
    });

    assertAccountActive(user);
    const permissions = await getUserPermissions(authUser.id);

    return NextResponse.json({
      user,
      permissions,
      redirectTo: await resolveOnboardingLoginPath(user, getDashboardPathForRole(user.role.systemRole, user.settings)),
    });
  } catch (error) {
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
    console.error("Auth sync error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation du profil" },
      { status: 500 }
    );
  }
}
