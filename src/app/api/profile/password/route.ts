import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { changePasswordSchema } from "@/lib/validations/auth";
import { LOGIN_BUSY_MESSAGE, loginBusyResponseInit, settleLoginAttempt, startLoginAttempt } from "@/domains/auth/login-rate-limit.service";
import { requestSourceFromHeaders } from "@/lib/security/request-source";
import { createAdminClient } from "@/services/supabase/admin";

// Panne réseau ou serveur Supabase Auth : ne compte pas comme un mauvais mot de passe.
function isAuthServiceUnavailable(error: { name?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return error.status === 0 || (typeof error.status === "number" && error.status >= 500);
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const body = await readJsonBody(request);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;
  const email = auth.context.user.email;

  // SEC-2 : la vérification du mot de passe actuel suit la même limite que la connexion.
  const rateLimit = await startLoginAttempt({ email, source: requestSourceFromHeaders(request.headers), trackEmail: true });
  if (!rateLimit.allowed && rateLimit.busy) {
    return NextResponse.json({ error: LOGIN_BUSY_MESSAGE }, loginBusyResponseInit());
  }
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (isAuthServiceUnavailable(verifyError)) {
    await settleLoginAttempt(rateLimit.attempt, "cancelled");
    return NextResponse.json(
      { error: "Service momentanément indisponible. Réessayez dans quelques instants." },
      { status: 503 }
    );
  }

  if (verifyError) {
    await settleLoginAttempt(rateLimit.attempt, "failure");
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect" },
      { status: 400 }
    );
  }
  await settleLoginAttempt(rateLimit.attempt, "success");

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    auth.context.authId,
    { password: newPassword }
  );

  if (updateError) {
    // Le détail Supabase reste dans le journal serveur.
    console.error("Password update failed:", updateError.message);
    const weak = (updateError as { code?: string }).code === "weak_password" || updateError.status === 422;
    return NextResponse.json(
      weak
        ? { error: "Le nouveau mot de passe ne respecte pas les règles de sécurité." }
        : { error: "Impossible de modifier le mot de passe" },
      { status: weak ? 400 : 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Mot de passe mis à jour" });
  });
}
