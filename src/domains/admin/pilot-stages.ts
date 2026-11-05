import type { PilotStage } from "@prisma/client";

/**
 * ADMIN-ESPACE, lot 4 : étapes d'un pilote accompagné, reprises du protocole PILOT-1
 * (docs/operations/pilot1/README.md). Sans accès à la base : importable par l'écran.
 */

export const PILOT_STAGES = [
  "PREPARATION",
  "ACTIVATION",
  "FIRST_VALUE",
  "REPRESENTATIVE_USE",
  "CONSOLIDATION",
  "CONTINUED",
  "STOPPED",
] as const satisfies readonly PilotStage[];

/** Libellés repris du protocole PILOT-1 (semaine 0 à 4, puis décision de sortie). */
export const PILOT_STAGE_LABELS: Record<PilotStage, string> = {
  PREPARATION: "Préparation",
  ACTIVATION: "Activation",
  FIRST_VALUE: "Première valeur",
  REPRESENTATIVE_USE: "Usage représentatif",
  CONSOLIDATION: "Consolidation et sortie",
  CONTINUED: "Poursuite payante",
  STOPPED: "Arrêt",
};

export const PILOT_STAGE_HINTS: Record<PilotStage, string> = {
  PREPARATION: "Semaine 0 : portes, espace, formation, livraison fictive.",
  ACTIVATION: "Semaine 1 : espace ouvert, les trois rôles se connectent.",
  FIRST_VALUE: "Première livraison terminée avec statut, échange et preuve.",
  REPRESENTATIVE_USE: "Semaines 2 et 3 : usage réel, point hebdomadaire.",
  CONSOLIDATION: "Semaine 4 : livraison rejouée, export, entretiens de sortie.",
  CONTINUED: "Décision de sortie : l'entreprise continue en payant.",
  STOPPED: "Décision de sortie ou suspension : le pilote s'arrête.",
};

/** Pilote commencé et pas encore sorti : compteur « pilotes en cours » de l'accueil. */
export const PILOT_IN_PROGRESS: readonly PilotStage[] = ["ACTIVATION", "FIRST_VALUE", "REPRESENTATIVE_USE", "CONSOLIDATION"];
export const PILOT_TERMINAL: readonly PilotStage[] = ["CONTINUED", "STOPPED"];
/** Étapes qui supposent une première livraison terminée (saisie ou déduite). */
export const NEEDS_FIRST_DELIVERY: readonly PilotStage[] = ["FIRST_VALUE", "REPRESENTATIVE_USE", "CONSOLIDATION", "CONTINUED"];

/**
 * Passages autorisés : une étape en avant, une en arrière (correction), l'arrêt à tout moment ;
 * la poursuite payante seulement après la consolidation ; un pilote arrêté peut reprendre à n'importe quelle étape.
 */
export const PILOT_TRANSITIONS: Record<PilotStage, readonly PilotStage[]> = {
  PREPARATION: ["ACTIVATION", "STOPPED"],
  ACTIVATION: ["PREPARATION", "FIRST_VALUE", "STOPPED"],
  FIRST_VALUE: ["ACTIVATION", "REPRESENTATIVE_USE", "STOPPED"],
  REPRESENTATIVE_USE: ["FIRST_VALUE", "CONSOLIDATION", "STOPPED"],
  CONSOLIDATION: ["REPRESENTATIVE_USE", "CONTINUED", "STOPPED"],
  CONTINUED: ["CONSOLIDATION"],
  STOPPED: ["PREPARATION", "ACTIVATION", "FIRST_VALUE", "REPRESENTATIVE_USE", "CONSOLIDATION"],
};

export function canTransition(from: PilotStage, to: PilotStage) {
  return PILOT_TRANSITIONS[from].includes(to);
}
