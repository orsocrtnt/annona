import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DEFAULT_PROOF_RULES, parseProofRules, proofRulesSchema, type ProofRules } from "./pod-evidence";

export async function getCompanyProofRules(companyId: string): Promise<ProofRules> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  if (!company) return DEFAULT_PROOF_RULES;
  return parseProofRules((company.settings as Record<string, unknown> | null)?.proofRules);
}

export async function updateCompanyProofRules(companyId: string, input: unknown): Promise<ProofRules> {
  const rules = proofRulesSchema.parse(input);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  const current = (company.settings ?? {}) as Record<string, unknown>;
  await prisma.company.update({
    where: { id: companyId },
    data: { settings: { ...current, proofRules: rules } as Prisma.InputJsonValue },
  });
  return rules;
}
