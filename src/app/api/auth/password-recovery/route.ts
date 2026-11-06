import { requestSourceFromHeaders } from "@/lib/security/request-source";
import { isOverRequestLimit } from "@/lib/security/request-limit";
import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordRecovery } from "@/domains/auth/password-link.service";

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const source = requestSourceFromHeaders(request.headers);
  if (await isOverRequestLimit("password-recovery-source", source, 10) || await isOverRequestLimit("password-recovery-email", parsed.data.email.trim().toLowerCase(), 3)) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
  }
  try {
    await requestPasswordRecovery(parsed.data.email);
    return NextResponse.json({ success: true, message: "Si cette adresse peut recevoir un lien, un e-mail sera envoyé." });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "AUTH_RATE_LIMITED" ? 429 : code === "AUTH_EMAIL_NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json({ error: status === 429 ? "Trop de demandes. Réessayez plus tard." : status === 503 ? CONFIG_MESSAGES.AUTH_EMAIL_UNAVAILABLE : "Envoi indisponible. Réessayez plus tard." }, { status });
  }
}
