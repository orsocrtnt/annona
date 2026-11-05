/**
 * ADMIN-ESPACE, lot 5 : étapes du fichier de prospection, d'après docs/operations/prospection/README.md, partie 9 :
 * À qualifier → Contacté → En discussion → Entretien fait → Démo faite → Intéressé → Pilote signé,
 * ou Perdu, ou Ne plus contacter. Fichier sans base de données, partagé avec l'écran.
 */

export const PROSPECT_STAGES = [
  "TO_QUALIFY",
  "CONTACTED",
  "DISCUSSING",
  "INTERVIEWED",
  "DEMO_DONE",
  "INTERESTED",
  "PILOT_SIGNED",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

export type ProspectStage = (typeof PROSPECT_STAGES)[number];

export const PROSPECT_STAGE_LABELS: Record<ProspectStage, string> = {
  TO_QUALIFY: "À qualifier",
  CONTACTED: "Contacté",
  DISCUSSING: "En discussion",
  INTERVIEWED: "Entretien fait",
  DEMO_DONE: "Démo faite",
  INTERESTED: "Intéressé",
  PILOT_SIGNED: "Pilote signé",
  LOST: "Perdu",
  DO_NOT_CONTACT: "Ne plus contacter",
};

/** Libellés acceptés dans la Sheet (après normalisation : minuscules, sans accents ni ponctuation). */
export const PROSPECT_STAGE_ALIASES: Record<ProspectStage, readonly string[]> = {
  TO_QUALIFY: ["a qualifier"],
  CONTACTED: ["contacte", "contactee", "contactes", "contactees"],
  DISCUSSING: ["en discussion", "discussion", "en cours de discussion"],
  INTERVIEWED: ["entretien fait", "entretien realise", "entretien"],
  DEMO_DONE: ["demo faite", "demo realisee", "demonstration faite", "demonstration realisee", "demo"],
  INTERESTED: ["interesse", "interessee", "interesses", "interessees"],
  PILOT_SIGNED: ["pilote signe", "pilote"],
  LOST: ["perdu", "perdue", "perdus"],
  DO_NOT_CONTACT: ["ne plus contacter", "ne pas contacter", "stop"],
};

/** Étapes d'une entreprise déjà contactée (toutes sauf « À qualifier »). */
export const CONTACTED_STAGES: readonly ProspectStage[] = [
  "CONTACTED",
  "DISCUSSING",
  "INTERVIEWED",
  "DEMO_DONE",
  "INTERESTED",
  "PILOT_SIGNED",
  "LOST",
  "DO_NOT_CONTACT",
];

/**
 * Une ligne par entreprise : l'étape actuelle implique les précédentes. « Au moins en discussion » compte donc
 * En discussion, Entretien fait, Démo faite, Intéressé et Pilote signé. Perdu et Ne plus contacter n'y entrent pas :
 * leur histoire n'est pas connue.
 */
export const AT_LEAST: Record<"conversations" | "interviews" | "demos" | "interested", readonly ProspectStage[]> = {
  conversations: ["DISCUSSING", "INTERVIEWED", "DEMO_DONE", "INTERESTED", "PILOT_SIGNED"],
  interviews: ["INTERVIEWED", "DEMO_DONE", "INTERESTED", "PILOT_SIGNED"],
  demos: ["DEMO_DONE", "INTERESTED", "PILOT_SIGNED"],
  interested: ["INTERESTED", "PILOT_SIGNED"],
};

/** Rappels non affichés pour ces étapes : on ne relance ni un refus ni une entreprise perdue. */
export const NO_REMINDER_STAGES: readonly ProspectStage[] = ["LOST", "DO_NOT_CONTACT"];
