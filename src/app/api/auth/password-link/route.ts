import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { finishPasswordLink } from "@/domains/auth/password-link.service";

const tokenHash = z.string().min(20).max(512);
const schema = z.union([
  resetPasswordSchema.and(z.object({ tokenHash, type: z.enum(["invite", "recovery"]) })),
  z.object({ tokenHash, type: z.literal("signup") }),
]);
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lien ou mot de passe invalide." }, { status: 400 });
  try {
    await finishPasswordLink(parsed.data);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "AUTH_RATE_LIMITED" ? 429 : code === "AUTH_EMAIL_NOT_CONFIGURED" ? 503 : code === "AUTH_LINK_INVALID" ? 400 : 502;
    return NextResponse.json({ error: status === 429 ? "Trop de tentatives. Réessayez plus tard." : status === 503 ? "Le service d’invitation est indisponible." : "Lien expiré, déjà utilisé ou indisponible. Demandez un nouveau lien." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
