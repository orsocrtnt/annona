import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { changePasswordSchema } from "@/lib/validations/auth";
import { createAdminClient } from "@/services/supabase/admin";

export async function POST(request: Request) {
  return withApiHandler(async () => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;
  const email = auth.context.user.email;

  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    auth.context.authId,
    { password: newPassword }
  );

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Impossible de modifier le mot de passe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Mot de passe mis à jour" });
  });
}
