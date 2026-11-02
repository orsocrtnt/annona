import { type NextRequest, NextResponse } from "next/server";
import {
  SIGNUP_COOKIE,
  processFakeSignupPayment,
  signupPaidEnvironmentPath,
} from "@/domains/signup/signup.service";
import { clearSignupResumeCookie } from "@/domains/signup/signup-cookie";
import { signupTestShortcutsAllowed } from "@/domains/signup/signup-availability";
import { createAdminClient } from "@/services/supabase/admin";
import { createClient } from "@/services/supabase/server";
import { sandboxBilling } from "@/domains/billing/billing.service";
import { fakePaymentSchema } from "@/lib/validations/signup";

async function openActivatedSignupSession(email: string, authUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = data.properties?.hashed_token;
  if (error || !hashedToken || (data.user?.id && data.user.id !== authUserId)) {
    throw new Error("SIGNUP_SESSION_UNAVAILABLE");
  }
  const supabase = await createClient();
  const verified = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (verified.error || verified.data.user?.id !== authUserId) {
    throw new Error("SIGNUP_SESSION_UNAVAILABLE");
  }
}

export async function POST(request: NextRequest) {
  if (process.env.SIGNUP_PAYMENT_ADAPTER === "stripe-sandbox") {
    const token = request.cookies.get(SIGNUP_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Inscription absente." }, { status: 401 });
    try {
      const result = await sandboxBilling().checkout(token);
      return NextResponse.json({ checkoutUrl: result.url }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Le paiement sandbox est indisponible. Votre inscription est conservée." }, { status: 503 });
    }
  }
  if (!signupTestShortcutsAllowed()) return NextResponse.json({ error: "Le paiement fictif n'est pas actif sur cet environnement." }, { status: 503 });
  const token = request.cookies.get(SIGNUP_COOKIE)?.value;
  const parsed = fakePaymentSchema.safeParse(await request.json().catch(() => null));
  if (!token || !parsed.success) return NextResponse.json({ error: "Demande de paiement invalide." }, { status: 400 });
  try {
    const result = await processFakeSignupPayment(token, parsed.data);
    let redirectTo: string | null = null;
    if (result.activated) {
      let sessionOpened = false;
      if (result.authUserId) {
        try {
          await openActivatedSignupSession(result.email, result.authUserId);
          sessionOpened = true;
        } catch (error) {
          console.error("SIGNUP_SESSION_OPEN_FAILED", error);
        }
      }
      redirectTo = signupPaidEnvironmentPath(result.email, sessionOpened);
    }
    const response = NextResponse.json({ ...result, redirectTo }, { headers: { "Cache-Control": "no-store" } });
    if (result.activated) clearSignupResumeCookie(response);
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "SIGNUP_EMAIL_UNVERIFIED" ? 409 : code === "SIGNUP_ALREADY_EXISTS" ? 409 : 502;
    const message = code === "SIGNUP_EMAIL_UNVERIFIED"
      ? "Confirmez d'abord votre adresse e-mail."
      : code === "SIGNUP_ALREADY_EXISTS"
        ? "Cette inscription ne peut pas être activée. Connectez-vous ou contactez le support."
        : "Le paiement fictif n'a pas pu être confirmé. Réessayez sans créer un second compte.";
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: NextRequest) {
  if (process.env.SIGNUP_PAYMENT_ADAPTER !== "stripe-sandbox") return NextResponse.json({ error: "Indisponible" }, { status: 404 });
  const token = request.cookies.get(SIGNUP_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Inscription absente." }, { status: 401 });
  try {
    const billing = sandboxBilling();
    const account = await billing.accountForSignup(token);
    const state = await billing.reconcile(account.id);
    return NextResponse.json({ status: state.status, confirmed: Boolean(state.activeContract) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Confirmation en attente. Réessayez." }, { status: 503 }); }
}
