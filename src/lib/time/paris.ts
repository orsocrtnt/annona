/**
 * Heure de Paris, changements d'heure compris. Sert à l'heure limite de commande (RG-01),
 * aux créneaux et aux tournées : toute date métier se lit dans ce fuseau, jamais en UTC.
 */
export const PARIS_TIME_ZONE = "Europe/Paris";

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface WallClockTime {
  hour: number;
  minute: number;
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const pad = (value: number) => String(value).padStart(2, "0");

/** Composantes de date et d'heure d'un instant, lues dans un fuseau (Paris par défaut). */
export function zonedParts(instant: Date, timeZone: string = PARIS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Composantes de date et d'heure d'un instant, lues à Paris. */
export function parisParts(instant: Date) {
  return zonedParts(instant, PARIS_TIME_ZONE);
}

/** Date du jour (AAAA-MM-JJ) dans un fuseau donné. */
export function zonedTodayDate(now: Date, timeZone: string = PARIS_TIME_ZONE): CalendarDate {
  const { year, month, day } = zonedParts(now, timeZone);
  return { year, month, day };
}

/** Date calendaire au format AAAA-MM-JJ. */
export function formatCalendarDate(date: CalendarDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Date du jour à Paris (AAAA-MM-JJ) et jour de la semaine en français. */
export function parisToday(now: Date) {
  const { year, month, day } = parisParts(now);
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  return { date, weekday };
}

/** Lit une date AAAA-MM-JJ réelle ; `null` si le format ou le jour est invalide. */
export function parseCalendarDate(value: string | null): CalendarDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Lit une heure HH:MM valide ; `null` sinon. */
export function parseWallClockTime(value: string | null): (WallClockTime & { text: string }) | null {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, text: `${pad(hour)}:${pad(minute)}` };
}

/** Décale une date calendaire d'un nombre de jours. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** Convertit une heure murale d'un fuseau en instant UTC, changements d'heure compris. */
export function zonedWallTimeToUtc(date: CalendarDate, time: WallClockTime, timeZone: string = PARIS_TIME_ZONE) {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let guess = wall;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const seen = zonedParts(new Date(guess), timeZone);
    const seenWall = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += wall - seenWall;
  }
  return new Date(guess);
}

/** Convertit une heure murale de Paris en instant UTC, changements d'heure compris. */
export function parisWallTimeToUtc(date: CalendarDate, time: WallClockTime) {
  return zonedWallTimeToUtc(date, time, PARIS_TIME_ZONE);
}

/** Date AAAA-MM-JJ et heure HH:MM de Paris en instant UTC ; `null` si l'une est invalide. */
export function parisInstant(date: string, time: string): Date | null {
  const day = parseCalendarDate(date);
  const hour = parseWallClockTime(time);
  return day && hour ? parisWallTimeToUtc(day, hour) : null;
}
