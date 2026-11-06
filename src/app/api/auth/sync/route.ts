import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAccountActive, AccountUnavailableError } from "@/lib/auth/account-access";
import { createClient } from "@/services/supabase/server";
import {
  syncUserFromSupabase,
  getDashboardPathForRole,
  UserNotProvisionedError,
} from "@/domains/auth/auth.service";
import { getUserPermissions } from "@/domains/user/user.service";

// Aucun champ accepté : le profil vient uniquement de la base, jamais du client.
const syncBodySchema = z.object({}).strict();

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text().catch(() => "");
    if (raw.trim() && !syncBodySchema.safeParse(parseJson(raw)).success) {
      return NextResponse.json({ error: "Requête de synchronisation invalide." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.email || !authUser.email_confirmed_at) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await syncUserFromSupabase({ authId: authUser.id, email: authUser.email });

    assertAccountActive(user);
    const permissions = await getUserPermissions(authUser.id);

    return NextResponse.json({
      user,
      permissions,
      redirectTo: getDashboardPathForRole(user.role.systemRole),
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
