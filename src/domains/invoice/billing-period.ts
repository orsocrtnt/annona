/**
 * FACT-1 — périodes de facturation (CLI-10, ADM-10) : jour, semaine ISO (lundi → dimanche), mois civil,
 * année civile. Une commande appartient à la période qui contient sa date de livraison (jour civil,
 * colonne `@db.Date`) : les bornes sont des jours civils, sans heure, donc insensibles aux changements
 * d'heure. Seule la date « du jour » dépend de l'instant présent : elle est lue dans le fuseau de
 * l'entreprise (Europe/Paris), jamais en UTC (à 0 h 30 à Paris, c'est déjà le lendemain).
 *
 * Fonctions pures, partagées par le service de génération, le cron et les écrans.
 */
import type { BillingPeriod } from "@prisma/client";
import { addCalendarDays, formatCalendarDate, parseCalendarDate, zonedTodayDate, type CalendarDate } from "@/lib/time/paris";

export const BILLING_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const satisfies readonly BillingPeriod[];

export interface BillingPeriodRange {
  type: BillingPeriod;
  /** Premier jour inclus, « AAAA-MM-JJ ». */
  start: string;
  /** Dernier jour inclus, « AAAA-MM-JJ ». */
  end: string;
}

const toKey = formatCalendarDate;

function requireDate(value: string): CalendarDate {
  const date = parseCalendarDate(value);
  if (!date) throw new Error("INVALID_PERIOD_DATE");
  return date;
}

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
function isoWeekday(date: CalendarDate): number {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Période de type `type` qui contient le jour `date` (« AAAA-MM-JJ »). */
export function periodContaining(type: BillingPeriod, date: string): BillingPeriodRange {
  const day = requireDate(date);
  switch (type) {
    case "DAILY":
      return { type, start: toKey(day), end: toKey(day) };
    case "WEEKLY": {
      const monday = addCalendarDays(day, 1 - isoWeekday(day));
      return { type, start: toKey(monday), end: toKey(addCalendarDays(monday, 6)) };
    }
    case "MONTHLY":
      return {
        type,
        start: toKey({ year: day.year, month: day.month, day: 1 }),
        end: toKey({ year: day.year, month: day.month, day: lastDayOfMonth(day.year, day.month) }),
      };
    case "YEARLY":
      return { type, start: `${day.year}-01-01`, end: `${day.year}-12-31` };
  }
}

/** Période qui précède immédiatement `period` (même type). */
export function previousPeriod(period: BillingPeriodRange): BillingPeriodRange {
  return periodContaining(period.type, toKey(addCalendarDays(requireDate(period.start), -1)));
}

/** Période qui suit immédiatement `period` (même type). */
export function nextPeriod(period: BillingPeriodRange): BillingPeriodRange {
  return periodContaining(period.type, toKey(addCalendarDays(requireDate(period.end), 1)));
}

/** Jour civil courant (« AAAA-MM-JJ ») dans le fuseau de l'entreprise. */
export function todayKey(now: Date, timeZone: string): string {
  return toKey(zonedTodayDate(now, timeZone));
}

/** Période en cours (contenant aujourd'hui, fuseau de l'entreprise). */
export function currentPeriod(type: BillingPeriod, now: Date, timeZone: string): BillingPeriodRange {
  return periodContaining(type, todayKey(now, timeZone));
}

/** Vrai quand le dernier jour de la période est passé (fuseau de l'entreprise). */
export function isPeriodClosed(period: BillingPeriodRange, now: Date, timeZone: string): boolean {
  return period.end < todayKey(now, timeZone);
}

/** Vrai quand la période n'a pas encore commencé. */
export function isPeriodInFuture(period: BillingPeriodRange, now: Date, timeZone: string): boolean {
  return period.start > todayKey(now, timeZone);
}

/** Numéro de semaine ISO 8601 et son année (la semaine du 1er janvier peut appartenir à l'année précédente). */
export function isoWeek(date: string): { year: number; week: number } {
  const day = requireDate(date);
  // Le jeudi de la semaine donne l'année ISO.
  const thursday = addCalendarDays(day, 4 - isoWeekday(day));
  const firstJanuary = Date.UTC(thursday.year, 0, 1);
  const week = Math.floor((Date.UTC(thursday.year, thursday.month - 1, thursday.day) - firstJanuary) / 86_400_000 / 7) + 1;
  return { year: thursday.year, week };
}

/** Valeur d'une colonne `@db.Date` (minuit UTC du jour civil). */
export function periodDateToDb(date: string): Date {
  requireDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

/** « AAAA-MM-JJ » d'une colonne `@db.Date`. */
export function dbDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const noon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Libellé lisible : « 5 novembre 2026 », « Semaine 45 · du 2 au 8 novembre 2026 », « Novembre 2026 », « Année 2026 ». */
export function periodLabel(period: Pick<BillingPeriodRange, "type" | "start" | "end">): string {
  switch (period.type) {
    case "DAILY":
      return dayMonthYear.format(noon(period.start));
    case "WEEKLY": {
      const { week } = isoWeek(period.start);
      const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
      const from = sameYear ? dayMonth.format(noon(period.start)) : dayMonthYear.format(noon(period.start));
      return `Semaine ${week} · du ${from} au ${dayMonthYear.format(noon(period.end))}`;
    }
    case "MONTHLY":
      return capitalize(monthYear.format(noon(period.start)));
    case "YEARLY":
      return `Année ${period.start.slice(0, 4)}`;
  }
}

/** « du 2 au 8 novembre 2026 » (bornes incluses), pour les mentions de la facture. */
export function periodRangeLabel(period: Pick<BillingPeriodRange, "start" | "end">): string {
  if (period.start === period.end) return `le ${dayMonthYear.format(noon(period.start))}`;
  return `du ${dayMonthYear.format(noon(period.start))} au ${dayMonthYear.format(noon(period.end))}`;
}

const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Forme courte (PDF, cartes) : « 05/11/2026 », « Semaine 45 · 2026 », « Novembre 2026 », « 2026 ». */
export function periodShortLabel(period: Pick<BillingPeriodRange, "type" | "start" | "end">): string {
  switch (period.type) {
    case "DAILY":
      return shortDay.format(noon(period.start));
    case "WEEKLY": {
      const { year, week } = isoWeek(period.start);
      return `Semaine ${week} · ${year}`;
    }
    case "MONTHLY":
      return capitalize(monthYear.format(noon(period.start)));
    case "YEARLY":
      return period.start.slice(0, 4);
  }
}
