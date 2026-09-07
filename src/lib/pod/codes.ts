export const POD_FAILURE_CODES = [
  "ABSENT",
  "REFUSED",
  "WRONG_ADDRESS",
  "INACCESSIBLE",
  "DAMAGED",
  "OTHER",
] as const;

export type PodFailureCode = (typeof POD_FAILURE_CODES)[number];

export const POD_FAILURE_LABELS: Record<PodFailureCode, string> = {
  ABSENT: "Destinataire absent",
  REFUSED: "Refus du colis",
  WRONG_ADDRESS: "Mauvaise adresse",
  INACCESSIBLE: "Accès impossible",
  DAMAGED: "Colis endommagé",
  OTHER: "Autre",
};

export type PodOutcome = "SUCCESS" | "FAILED";
