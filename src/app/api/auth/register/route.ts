import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { provisionCompanyAdmin } from "@/domains/auth/provision-company-admin";

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

    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status = code === "AUTH_RATE_LIMITED" ? 429 :
      ["AUTH_EMAIL_NOT_CONFIGURED", "AUTH_EMAIL_CONFIRMATION_REQUIRED"].includes(code) ? 503 : 502;
    return NextResponse.json({ error: status === 429 ? "Trop de demandes. Réessayez plus tard." :
      "Inscription indisponible. Réessayez plus tard." }, { status });
  }
}
