import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { finishPasswordLink } from "@/domains/auth/password-link.service";
import { zodIssueMessage } from "@/lib/config-messages";

const tokenHash = z.string().min(20).max(512);
const accessToken = z.string().min(20).max(8192);
// Supabase émet des refresh tokens courts (12 caractères en préproduction).
const refreshToken = z.string().min(8).max(1024);
const tokenHashSchema = resetPasswordSchema.and(z.object({ tokenHash, type: z.enum(["invite", "recovery"]) }));
const sessionSchema = resetPasswordSchema.and(z.object({ accessToken, refreshToken, type: z.enum(["invite", "recovery"]) }));
const schema = z.union([tokenHashSchema, sessionSchema]);
const LINK_INVALID = "Lien manquant ou invalide. Demandez un nouveau lien.";

/** Distingue un mot de passe refusé d'un lien illisible, sans renvoyer le contenu reçu. */
function invalidRequestMessage(body: unknown): string {
  const type = body && typeof body === "object" ? (body as { type?: unknown }).type : undefined;
  if (type !== "invite" && type !== "recovery") return LINK_INVALID;
  const password = resetPasswordSchema.safeParse(body);
  return password.success ? LINK_INVALID : zodIssueMessage(password.error, LINK_INVALID);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: invalidRequestMessage(body) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    await finishPasswordLink(parsed.data);
    return NextResponse.json({ success: true, redirectTo: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "AUTH_PASSWORD_WEAK" || code === "AUTH_PASSWORD_SAME") {
      // Lien de session : resté valide, on peut corriger. Lien token_hash : déjà consommé.
      const retry = "tokenHash" in parsed.data ? " Demandez un nouveau lien pour réessayer." : "";
      const reason = code === "AUTH_PASSWORD_SAME"
        ? "Choisissez un mot de passe différent de l’actuel."
        : "Ce mot de passe est refusé : au moins 8 caractères, dont une majuscule, une minuscule et un chiffre.";
      return NextResponse.json({ error: reason + retry }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const status = code === "AUTH_RATE_LIMITED" ? 429 : code === "AUTH_EMAIL_NOT_CONFIGURED" ? 503 : code === "AUTH_LINK_INVALID" ? 400 : 502;
    return NextResponse.json({ error: status === 429 ? "Trop de tentatives. Réessayez plus tard." : status === 503 ? "Le service d’invitation est indisponible." : "Lien expiré, déjà utilisé ou indisponible. Demandez un nouveau lien." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
