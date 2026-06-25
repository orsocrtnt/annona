import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { provisionCompanyAdmin } from "@/domains/auth/provision-company-admin";
import { createClient } from "@/services/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, companyName } = parsed.data;
    const normalizedEmail = normalizeEmail(email);

    const result = await provisionCompanyAdmin({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      companyName,
    });

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        {
          error:
            "Compte configuré mais connexion impossible. Utilisez la page de connexion avec le même mot de passe.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: result.user,
      permissions: result.permissions,
      redirectTo: result.redirectTo,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création du compte",
      },
      { status: 500 }
    );
  }
}
