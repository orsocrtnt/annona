import { type NextRequest, NextResponse } from "next/server";
import { SIGNUP_COOKIE, processFakeSignupPayment } from "@/domains/signup/signup.service";
import { clearSignupResumeCookie } from "@/domains/signup/signup-cookie";
import { fakePaymentSchema } from "@/lib/validations/signup";

export async function POST(request: NextRequest) {
  const enabled = process.env.SIGNUP_PAYMENT_ADAPTER === "fake" && process.env.VERCEL_ENV !== "production";
  if (!enabled) return NextResponse.json({ error: "Le paiement fictif n'est pas actif sur cet environnement." }, { status: 503 });
  const token = request.cookies.get(SIGNUP_COOKIE)?.value;
  const parsed = fakePaymentSchema.safeParse(await request.json().catch(() => null));
  if (!token || !parsed.success) return NextResponse.json({ error: "Demande de paiement invalide." }, { status: 400 });
  try {
    const result = await processFakeSignupPayment(token, parsed.data);
    const response = NextResponse.json({ ...result, redirectTo: result.activated ? `/login?email=${encodeURIComponent(result.email)}&redirect=/onboarding` : null }, { headers: { "Cache-Control": "no-store" } });
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
