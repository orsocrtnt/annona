/** Dates lisibles d'un coup d'œil dans les listes : « Aujourd'hui 14:30 », « Hier », « 23 oct. ». */

const TIME_ZONE = "Europe/Paris";
const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const shortDateYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const fullDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: TIME_ZONE });

function dayDiff(date: Date, now: Date): number {
  const [a, b] = [dayKey.format(date), dayKey.format(now)].map((key) => Date.parse(`${key}T00:00:00Z`));
  return Math.round((a! - b!) / 86_400_000);
}

export function relativeDayLabel(value: string | Date, now = new Date(), options: { withTime?: boolean } = {}): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = dayDiff(date, now);
  const time = options.withTime ? ` ${timeFormat.format(date)}` : "";
  if (diff === 0) return `Aujourd'hui${time}`;
  if (diff === -1) return `Hier${time}`;
  if (diff === 1) return `Demain${time}`;
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return (sameYear ? shortDate : shortDateYear).format(date);
}

/** Version complète pour l'infobulle et les lecteurs d'écran. */
export function fullDateLabel(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : fullDate.format(date);
}
