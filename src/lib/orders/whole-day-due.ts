const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Heure de Paris d'une commande « au jour » : due jusqu'à la fin de la journée, sans heure promise. */
export const WHOLE_DAY_DUE_TIME = "23:59";

export function isWholeDayDue(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && PARIS_TIME.format(date) === WHOLE_DAY_DUE_TIME;
}
