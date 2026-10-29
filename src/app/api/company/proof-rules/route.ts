import { firstFieldMessage } from "@/lib/config-messages";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { getCompanyProofRules, updateCompanyProofRules } from "@/domains/delivery/proof-settings.service";
import { proofRulesPatchSchema } from "@/domains/delivery/pod-evidence";

const PROOF_RULE_LABELS = { signatureRequired: "Signature obligatoire", emailToClient: "Envoi de la preuve au client" };

export async function GET() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  return NextResponse.json({ data: await getCompanyProofRules(companyId), success: true });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffRole("settings:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const parsed = proofRulesPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstFieldMessage(parsed.error.flatten(), PROOF_RULE_LABELS, "Paramètres de preuve invalides : choisissez au moins un réglage à modifier."), details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await updateCompanyProofRules(companyId, parsed.data), success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }
    throw error;
  }
}
