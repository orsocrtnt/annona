import { zodIssueMessage } from "@/lib/config-messages";
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
import { extractPermissionSlugs } from "@/domains/user/user.service";
import {
  LOGIN_BUSY_MESSAGE,
  loginBusyResponseInit,
  settleLoginAttempt,
  startLoginAttempt,
} from "@/domains/auth/login-rate-limit.service";
import { requestSourceFromHeaders } from "@/lib/security/request-source";

const SERVICE_UNAVAILABLE_MESSAGE =
  "Service de connexion momentanément indisponible. Réessayez dans quelques instants.";

// Panne réseau ou serveur côté Supabase Auth (AuthRetryableFetchError : status 0 ou 5xx).
// Détection par forme pour ne pas lier cette route à une classe du SDK.
function isAuthServiceUnavailable(error: { name?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return error.status === 0 || (typeof error.status === "number" && error.status >= 500);
}

// Base injoignable ou pool de connexions Prisma saturé.
function isDatabaseUnavailable(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string } | null;
  if (!candidate) return false;
  if (candidate.name === "PrismaClientInitializationError") return true;
  return candidate.code === "P1001" || candidate.code === "P1002" || candidate.code === "P2024";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodIssueMessage(parsed.error, "Données invalides") },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = normalizeEmail(email);
    // SEC-2 : contrôle avant Supabase ; réponse identique que le compte existe ou non.
    const [rateLimit, supabase] = await Promise.all([
      startLoginAttempt({
        email: normalizedEmail,
        source: requestSourceFromHeaders(request.headers),
        trackEmail: true,
      }),
      createClient(),
    ]);
    if (!rateLimit.allowed && rateLimit.busy) {
      return NextResponse.json({ error: LOGIN_BUSY_MESSAGE }, loginBusyResponseInit());
    }
    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
      return NextResponse.json(
        { error: `Trop de tentatives de connexion. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (isAuthServiceUnavailable(signInError)) {
      console.error("Login auth provider unavailable:", signInError);
      await settleLoginAttempt(rateLimit.attempt, "cancelled");
      return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    if (signInError || !signInData.user?.email) {
      await settleLoginAttempt(rateLimit.attempt, "failure");
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    after(async () => { await settleLoginAttempt(rateLimit.attempt, "success"); });

    const authUser = signInData.user;
    if (!authUser.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ error: "Confirmez votre adresse e-mail avant de vous connecter." }, { status: 403 });
    }

    // Adresse confirmée (vérifié ci-dessus) : une boulangerie inscrite par e-mail devient active ici
    // si son lien de confirmation a été ouvert dans un autre navigateur (AUTH-GOOGLE).
    const user = await syncUserFromSupabase(
      { authId: authUser.id, email: authUser.email! },
      { activatePending: true }
    );

    assertAccountActive(user);
    const permissions = extractPermissionSlugs(user);

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
    console.error("Login error:", error);
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}
