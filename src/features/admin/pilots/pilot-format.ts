import type { PilotStage } from "@prisma/client";
import { PILOT_STAGE_LABELS } from "@/domains/admin/pilot-stages";
import type { FirstDelivery } from "@/domains/admin/pilots.service";

/** Libellés et formats des pilotes (ADMIN-ESPACE lot 4). Les jours civils sont déjà ceux de Paris. */

const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const numberFormat = new Intl.NumberFormat("fr-FR");

/** « 2026-11-05 » → « 5 nov. 2026 ». */
export function formatDay(key: string | null | undefined) {
  return key ? dayFormat.format(new Date(`${key}T00:00:00.000Z`)) : "—";
}

export function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}

export function formatCount(value: number) {
  return numberFormat.format(value);
}

export function stageLabel(stage: PilotStage) {
  return PILOT_STAGE_LABELS[stage];
}

/** Durée depuis le début, en jours civils. */
export function elapsedLabel(daysSinceStart: number | null, startDate: string | null) {
  if (daysSinceStart === null) return startDate ? `Commence le ${formatDay(startDate)}` : "Pas encore commencé";
  if (daysSinceStart === 0) return "Commencé aujourd'hui";
  return `${formatCount(daysSinceStart)} jour${daysSinceStart > 1 ? "s" : ""} depuis le début`;
}

export function firstDeliverySource(first: FirstDelivery) {
  return first.source === "manual" ? "saisie" : "déduite des livraisons";
}

/** Pastille d'étape : préparation neutre, pilote en cours menthe, poursuite pleine, arrêt rouge doux. */
export const STAGE_TONE: Record<PilotStage, string> = {
  PREPARATION: "bg-muted text-foreground dark:bg-secondary",
  ACTIVATION: "bg-[#e3f7ec] text-[#08783f] dark:bg-brand-subtle dark:text-brand",
  FIRST_VALUE: "bg-[#e3f7ec] text-[#08783f] dark:bg-brand-subtle dark:text-brand",
  REPRESENTATIVE_USE: "bg-[#e3f7ec] text-[#08783f] dark:bg-brand-subtle dark:text-brand",
  CONSOLIDATION: "bg-[#e3f7ec] text-[#08783f] dark:bg-brand-subtle dark:text-brand",
  CONTINUED: "bg-[#08783f] text-white dark:bg-[#2fae6f] dark:text-[#0e1310]",
  STOPPED: "bg-[#fbefeb] text-[#8a3b2a] dark:bg-secondary dark:text-error",
};
