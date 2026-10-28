import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { getCompanyProofRules } from "@/domains/delivery/proof-settings.service";

/** Règles de preuve de l'entreprise du livreur connecté (l'entreprise vient de la session). */
export async function GET() {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  const rules = await getCompanyProofRules(companyId);
  return NextResponse.json(
    { data: { signatureRequired: rules.signatureRequired }, success: true },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
