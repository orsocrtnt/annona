import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { finishPasswordLink } from "@/domains/auth/password-link.service";
import { setSignupResumeCookie } from "@/domains/signup/signup-cookie";

const tokenHash = z.string().min(20).max(512);
const sessionToken = z.string().min(20).max(8192);
const tokenHashSchema = z.union([
  resetPasswordSchema.and(z.object({ tokenHash, type: z.enum(["invite", "recovery"]) })),
  z.object({ tokenHash, type: z.literal("signup") }),
]);
const sessionSchema = z.union([
  resetPasswordSchema.and(z.object({ accessToken: sessionToken, refreshToken: sessionToken, type: z.enum(["invite", "recovery"]) })),
  z.object({ accessToken: sessionToken, refreshToken: sessionToken, type: z.literal("signup") }),
]);
const schema = z.union([tokenHashSchema, sessionSchema]);
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lien ou mot de passe invalide." }, { status: 400 });
  try {
    const result = await finishPasswordLink(parsed.data);
    const response = NextResponse.json(
      { success: true, redirectTo: result.signupResumeToken ? "/register" : null },
      { headers: { "Cache-Control": "no-store" } }
    );
    if (result.signupResumeToken) setSignupResumeCookie(response, result.signupResumeToken);
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "AUTH_RATE_LIMITED" ? 429 : code === "AUTH_EMAIL_NOT_CONFIGURED" ? 503 : code === "AUTH_LINK_INVALID" ? 400 : 502;
    return NextResponse.json({ error: status === 429 ? "Trop de tentatives. Réessayez plus tard." : status === 503 ? "Le service d’invitation est indisponible." : "Lien expiré, déjà utilisé ou indisponible. Demandez un nouveau lien." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
