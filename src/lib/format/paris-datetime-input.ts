/**
 * Champ `datetime-local` à l'heure de Paris, quel que soit le fuseau du navigateur.
 * L'ancien code affichait l'heure UTC (`iso.slice(0, 16)`) puis la relisait comme heure locale :
 * chaque enregistrement reculait la livraison d'une heure (deux en été).
 */

const TIME_ZONE = "Europe/Paris";
const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parisParts(date: Date) {
  const parts = partsFormat.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Décalage de Paris par rapport à UTC, en millisecondes, à l'instant donné. */
function parisOffsetMs(date: Date): number {
  const p = parisParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO (UTC) → « 2026-11-05T23:59 », heure de Paris. Chaîne vide si la date est absente ou invalide. */
export function toParisDateTimeInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = parisParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** « 2026-11-05T23:59 » lu comme heure de Paris → ISO (UTC). `null` si la saisie est invalide. */
export function fromParisDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Deux passes : le décalage dépend de l'instant cherché (changement d'heure).
  let instant = asUtc - parisOffsetMs(new Date(asUtc));
  instant = asUtc - parisOffsetMs(new Date(instant));
  return new Date(instant).toISOString();
}
