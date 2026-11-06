/**
 * Libellés des dates de livraison (« AAAA-MM-JJ », jour civil) et des instants d'heure limite,
 * lus dans le fuseau de l'entreprise (Europe/Paris par défaut).
 */
function calendarToUtcNoon(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

/** « mar. 10 nov. » */
export function shortDeliveryDateLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(calendarToUtcNoon(date));
}

/** « mardi 10 novembre 2026 » */
export function longDeliveryDateLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(calendarToUtcNoon(date));
}

/** « lun. 9 nov. à 17:00 » : instant lu dans le fuseau donné. */
export function deadlineLabel(instant: string | Date, timeZone = "Europe/Paris"): string {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone }).format(value);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(value);
  return `${day} à ${time}`;
}

/** Ajoute des jours à une date « AAAA-MM-JJ ». */
export function addDaysToDateKey(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
