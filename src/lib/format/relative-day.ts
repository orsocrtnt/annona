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

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

/** « 27 oct. 2026 à 14:30 » : une seule forme de date-heure dans les fiches, à l'heure de Paris. */
export function dateTimeLabel(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = dateTimeFormat.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} à ${get("hour")}:${get("minute")}`;
}

/** « à l'instant », « il y a 25 s », « il y a 3 min », « il y a 2 h », puis la date. */
export function elapsedLabel(value: string | Date, now: number | Date = Date.now()): string {
  const date = new Date(value);
  const seconds = Math.floor((new Date(now).getTime() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return "—";
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `il y a ${Math.floor(seconds / 3600)} h`;
  return `le ${dateTimeLabel(date)}`;
}
