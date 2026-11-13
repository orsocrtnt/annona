import { NextResponse } from "next/server";
import { zodIssueMessage } from "@/lib/config-messages";
import { emailSignupSchema } from "@/lib/validations/auth";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { appOrigin } from "@/lib/auth/app-origin";
import { prisma } from "@/services/prisma/client";
import { createClient } from "@/services/supabase/server";
import { SIGNUP_SENT_MESSAGE, signUpCompanyWithEmail } from "@/domains/auth/company-signup.service";
import { supabaseSignupProvider } from "@/domains/auth/supabase-signup";
import type { CompanyAdminDb } from "@/domains/admin/company-admin.service";

/**
 * AUTH-GOOGLE : inscription d'une boulangerie par e-mail (entreprise « Essai » et son administrateur).
 * Même réponse que l'adresse soit libre ou non ; l'accès s'ouvre après le lien de confirmation.
 */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const parsed = emailSignupSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    const supabase = await createClient();
    const confirmRedirect = new URL("/auth/callback?intent=confirm", appOrigin(request)).toString();
    try {
      await signUpCompanyWithEmail(parsed.data, {
        db: prisma as unknown as CompanyAdminDb,
        auth: supabaseSignupProvider(supabase, confirmRedirect),
      });
    } catch (error) {
      // Envoi de l'e-mail impossible (SMTP) : message rédigé, pas de trace de panne générique.
      if (error instanceof DomainRuleError && error.status >= 500) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
    return NextResponse.json({ success: true, message: SIGNUP_SENT_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
  });
}
