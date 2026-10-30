import type { IntakeConfidence, IntakeDeadlineExtraction } from "./order-intake.schema";

export const ORDER_INTAKE_TIME_ZONE = "Europe/Paris";

export interface ResolvedDeadline {
  mode: IntakeDeadlineExtraction["mode"];
  /** Jour local à Paris, AAAA-MM-JJ. */
  date: string | null;
  time: string | null;
  endTime: string | null;
  /** Instant UTC correspondant à la date et l'heure de Paris. */
  iso: string | null;
  label: string | null;
  isPast: boolean;
  confidence: IntakeConfidence;
  source: string | null;
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function zonedParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_INTAKE_TIME_ZONE,
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

const pad = (value: number) => String(value).padStart(2, "0");

/** Date du jour à Paris (AAAA-MM-JJ) et jour de la semaine en français. */
export function parisToday(now: Date) {
  const { year, month, day } = zonedParts(now);
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  return { date, weekday };
}

function parseDate(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function parseTime(value: string | null) {
  const match = value?.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, text: `${pad(hour)}:${pad(minute)}` };
}

function addDays(date: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** Convertit une heure murale de Paris en instant UTC, changements d'heure compris. */
function parisWallTimeToUtc(date: { year: number; month: number; day: number }, time: { hour: number; minute: number }) {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let guess = wall;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const seen = zonedParts(new Date(guess));
    const seenWall = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += wall - seenWall;
  }
  return new Date(guess);
}

/** Date AAAA-MM-JJ et heure HH:MM de Paris en instant UTC ; `null` si l'une est invalide. */
export function parisInstant(date: string, time: string): Date | null {
  const day = parseDate(date);
  const hour = parseTime(time);
  return day && hour ? parisWallTimeToUtc(day, hour) : null;
}

const MODE_LABELS: Record<NonNullable<IntakeDeadlineExtraction["mode"]>, string> = {
  before: "avant",
  at: "à",
  after: "après",
  between: "entre",
};

/**
 * Résout l'échéance décrite par le modèle. Sans date explicite ni décalage, une heure seule
 * (« avant 15h ») vaut pour aujourd'hui à Paris. Rien n'est inventé si les champs sont invalides.
 */
export function resolveDeadline(deadline: IntakeDeadlineExtraction, now: Date): ResolvedDeadline {
  const today = parseDate(parisToday(now).date)!;
  const time = parseTime(deadline.time);
  const endTime = parseTime(deadline.endTime);
  const explicit = parseDate(deadline.date);
  const day = explicit
    ?? (deadline.dayOffset !== null ? addDays(today, deadline.dayOffset) : time ? today : null);

  const date = day ? `${day.year}-${pad(day.month)}-${pad(day.day)}` : null;
  const instant = day && time ? parisWallTimeToUtc(day, time) : null;
  // Sans heure, la journée est passée une fois minuit franchi à Paris.
  const endOfDay = day && !time ? parisWallTimeToUtc(addDays(day, 1), { hour: 0, minute: 0 }) : null;
  const modeLabel = deadline.mode ? MODE_LABELS[deadline.mode] : null;
  let label: string | null = null;
  if (date) {
    const [year, month, dayOfMonth] = date.split("-");
    const when = `${dayOfMonth}/${month}/${year}`;
    if (time && deadline.mode === "between" && endTime) label = `${when}, entre ${time.text} et ${endTime.text}`;
    else if (time) label = `${when}, ${modeLabel ?? "à"} ${time.text}`;
    else label = when;
  }

  return {
    mode: deadline.mode,
    date,
    time: time?.text ?? null,
    endTime: endTime?.text ?? null,
    iso: instant ? instant.toISOString() : null,
    label,
    isPast: instant
      ? instant.getTime() < now.getTime()
      : endOfDay ? endOfDay.getTime() <= now.getTime() : false,
    confidence: deadline.confidence,
    source: deadline.source,
  };
}
