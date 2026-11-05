/** Formats de la page Prospection (ADMIN-ESPACE lot 5). Fichier pur, testé sans navigateur. */

const numberFormat = new Intl.NumberFormat("fr-FR");
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function formatCount(value: number) {
  return numberFormat.format(value);
}

/** « 2026-11-06 » → « 6 nov. 2026 » ; vide → « — ». */
export function formatDay(key: string | null | undefined) {
  return key ? dayFormat.format(new Date(`${key}T00:00:00.000Z`)) : "—";
}

/** Heure de Paris : « 14:05 ». */
export function formatParisTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

/** « 3 jours de retard » à partir de deux jours civils. */
export function lateLabel(date: string, today: string) {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  const days = Math.round((toUtc(today) - toUtc(date)) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  return `${formatCount(days)} jour${days > 1 ? "s" : ""} de retard`;
}

