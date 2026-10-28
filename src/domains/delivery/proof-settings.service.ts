import { prisma } from "@/services/prisma/client";
import { DEFAULT_PROOF_RULES, parseProofRules, proofRulesPatchSchema, type ProofRules } from "./pod-evidence";

export async function getCompanyProofRules(companyId: string): Promise<ProofRules> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  if (!company) return DEFAULT_PROOF_RULES;
  return parseProofRules((company.settings as Record<string, unknown> | null)?.proofRules);
}

/**
 * Mise à jour partielle des règles de preuve. Une seule instruction SQL fusionne les champs fournis dans
 * `settings.proofRules` : les champs omis gardent leur valeur et les autres réglages de l'entreprise
 * (dispatch, tarifs…) ne sont ni lus ni réécrits, donc jamais écrasés par une mise à jour concurrente.
 */
export async function updateCompanyProofRules(companyId: string, input: unknown): Promise<ProofRules> {
  const patch = proofRulesPatchSchema.parse(input);
  const updated = await prisma.$executeRaw`
    UPDATE "companies"
    SET "settings" = jsonb_set(
      COALESCE("settings", '{}'::jsonb),
      '{proofRules}',
      COALESCE("settings" -> 'proofRules', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
      true
    )
    WHERE "id" = ${companyId}`;
  if (updated === 0) throw new Error("COMPANY_NOT_FOUND");
  return getCompanyProofRules(companyId);
}
