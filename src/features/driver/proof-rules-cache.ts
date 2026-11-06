/**
 * POD-2 : règles de preuve gardées sur le téléphone du livreur. Hors ligne, une règle « signature requise »
 * jamais chargée laissait enregistrer une preuve sans signature, refusée par le serveur à la reprise.
 */
export type DriverProofRules = { signatureRequired: boolean };

export const DRIVER_PROOF_RULES_KEY = "annona-driver-proof-rules";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readCachedProofRules(store: StorageLike | null = storage()): DriverProofRules | undefined {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(DRIVER_PROOF_RULES_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && typeof (parsed as DriverProofRules).signatureRequired === "boolean") {
      return { signatureRequired: (parsed as DriverProofRules).signatureRequired };
    }
  } catch {
    // Valeur illisible : traitée comme absente.
  }
  return undefined;
}

export function writeCachedProofRules(rules: DriverProofRules, store: StorageLike | null = storage()) {
  try {
    store?.setItem(DRIVER_PROOF_RULES_KEY, JSON.stringify({ signatureRequired: rules.signatureRequired }));
  } catch {
    // Stockage plein ou interdit : la règle reste en mémoire pour la session.
  }
}

/** Règle jamais connue (première mission hors ligne) : la signature est demandée par précaution. */
export function effectiveSignatureRequired(rules: DriverProofRules | undefined): boolean {
  return rules ? rules.signatureRequired : true;
}
