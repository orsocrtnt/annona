import { z } from "zod";

/**
 * Règles de preuve de livraison propres à l'entreprise (stockées dans `company.settings.proofRules`).
 * Par défaut la signature est facultative : une entreprise existante ne voit aucun changement tant
 * qu'elle n'active pas l'exigence. L'envoi automatique de la preuve au donneur d'ordre est actif.
 */
export const proofRulesSchema = z.object({
  signatureRequired: z.boolean().default(false),
  emailToClient: z.boolean().default(true),
});
export type ProofRules = z.infer<typeof proofRulesSchema>;

/** Mise à jour partielle : seuls les champs fournis changent, aucun défaut n'est réappliqué aux champs omis. */
export const proofRulesPatchSchema = z
  .object({ signatureRequired: z.boolean().optional(), emailToClient: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Aucun paramètre à modifier");
export type ProofRulesPatch = z.infer<typeof proofRulesPatchSchema>;
export const DEFAULT_PROOF_RULES: ProofRules = { signatureRequired: false, emailToClient: true };

export function parseProofRules(raw: unknown): ProofRules {
  const parsed = proofRulesSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return parsed.success ? parsed.data : DEFAULT_PROOF_RULES;
}

export const MAX_RECIPIENT_NAME = 120;
export const MAX_REFUSAL_REASON = 200;

export const podRecipientNameSchema = z.string().trim().min(2).max(MAX_RECIPIENT_NAME);
export const podSignatureRefusalSchema = z.string().trim().min(3).max(MAX_REFUSAL_REASON);

/** Règle partagée avec l'interface livreur : un nom saisi fait au moins 2 caractères ; obligatoire avec une signature. */
export function isPodEvidenceReady(input: {
  hasSignature: boolean;
  refusedToSign: boolean;
  signatureRequired: boolean;
  name: string;
  reason: string;
}): boolean {
  const name = input.name.trim();
  const nameOk = name.length === 0 || name.length >= 2;
  if (input.refusedToSign) return input.reason.trim().length >= 3 && nameOk;
  if (input.hasSignature) return name.length >= 2;
  return !input.signatureRequired && nameOk;
}

export type PodEvidenceErrorCode =
  | "POD_SIGNATURE_NOT_ALLOWED"
  | "POD_SIGNATURE_CONFLICT"
  | "POD_RECIPIENT_REQUIRED"
  | "POD_SIGNATURE_REQUIRED";

/**
 * Contrôle la cohérence signature / réceptionnaire / refus selon le résultat et les règles de l'entreprise.
 * Lève l'un des codes `PodEvidenceErrorCode`.
 */
export function assertPodEvidence(input: {
  status: "DELIVERED" | "FAILED";
  rules: ProofRules;
  hasSignature: boolean;
  recipientName?: string | null;
  signatureRefusedReason?: string | null;
}): { recipientName: string | null; signatureRefusedReason: string | null } {
  const name = input.recipientName?.trim() || null;
  const refusal = input.signatureRefusedReason?.trim() || null;

  if (input.status === "FAILED") {
    if (input.hasSignature || refusal || name) throw new Error("POD_SIGNATURE_NOT_ALLOWED");
    return { recipientName: null, signatureRefusedReason: null };
  }
  if (input.hasSignature && refusal) throw new Error("POD_SIGNATURE_CONFLICT");
  if (input.hasSignature && !name) throw new Error("POD_RECIPIENT_REQUIRED");
  if (name && !podRecipientNameSchema.safeParse(name).success) throw new Error("POD_RECIPIENT_REQUIRED");
  if (refusal && !podSignatureRefusalSchema.safeParse(refusal).success) throw new Error("POD_SIGNATURE_REQUIRED");
  if (input.rules.signatureRequired && !input.hasSignature && !refusal) throw new Error("POD_SIGNATURE_REQUIRED");
  return { recipientName: name, signatureRefusedReason: refusal };
}

export const POD_EVIDENCE_MESSAGES: Record<PodEvidenceErrorCode, string> = {
  POD_SIGNATURE_NOT_ALLOWED: "Une signature ne peut être jointe qu'à une livraison réussie.",
  POD_SIGNATURE_CONFLICT: "Choisissez entre la signature et le refus de signer.",
  POD_RECIPIENT_REQUIRED: "Indiquez le nom de la personne qui réceptionne (2 à 120 caractères).",
  POD_SIGNATURE_REQUIRED: "La signature du réceptionnaire est requise, ou le motif de son refus de signer.",
};

export function isPodEvidenceError(message: string): message is PodEvidenceErrorCode {
  return message in POD_EVIDENCE_MESSAGES;
}

/** Le chemin de stockage de la signature reste interne : les réponses d'API ne l'exposent jamais. */
export function withoutSignaturePath<T extends { podSignaturePath?: unknown }>(row: T): Omit<T, "podSignaturePath"> {
  const copy = { ...row };
  delete copy.podSignaturePath;
  return copy;
}
