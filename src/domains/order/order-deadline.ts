/**
 * Heure limite de commande (RG-01, CLI-06) et dates commandables (RG-02, RG-03).
 *
 * Une commande livrée le jour J reste modifiable et annulable tant que l'instant présent est
 * strictement avant J−1 à l'heure limite de l'entreprise (17:00 par défaut), lue dans le fuseau
 * de l'entreprise (Europe/Paris), changements d'heure compris. À 17:00:00 pile, elle ne l'est plus.
 *
 * Fonctions pures : le serveur les appelle à chaque écriture, l'interface s'en sert pour l'affichage.
 * Le verrouillage planifié (passage en LOCKED) relève de LOCK-1.
 */
import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
  parseWallClockTime,
  zonedTodayDate,
  zonedWallTimeToUtc,
  type CalendarDate,
} from "@/lib/time/paris";

/** Date de livraison : « AAAA-MM-JJ » ou Date d'une colonne `@db.Date` (minuit UTC). */
export type DeliveryDateInput = string | Date;

export function toCalendarDate(value: DeliveryDateInput): CalendarDate | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
  }
  return parseCalendarDate(value);
}

/** « AAAA-MM-JJ » d'une date de livraison. */
export function deliveryDateKey(value: DeliveryDateInput): string {
  const date = toCalendarDate(value);
  if (!date) throw new Error("INVALID_DELIVERY_DATE");
  return formatCalendarDate(date);
}

/** Date de livraison en valeur de colonne `@db.Date` (minuit UTC du jour civil). */
export function deliveryDateToDb(value: DeliveryDateInput): Date {
  return new Date(`${deliveryDateKey(value)}T00:00:00.000Z`);
}

/** Instant de l'heure limite d'une livraison : J−1 à `cutoffTime`, dans `timeZone` (RG-01). */
export function orderCutoffInstant(deliveryDate: DeliveryDateInput, cutoffTime: string, timeZone: string): Date {
  const day = toCalendarDate(deliveryDate);
  const time = parseWallClockTime(cutoffTime);
  if (!day) throw new Error("INVALID_DELIVERY_DATE");
  if (!time) throw new Error("INVALID_CUTOFF_TIME");
  return zonedWallTimeToUtc(addCalendarDays(day, -1), time, timeZone);
}

/**
 * CLI-06 / RG-01 : vrai tant que `now` < (date de livraison − 1 jour) à `cutoffTime`, heure de
 * `timeZone`. Critère de recette 2 : 16:59 modifiable, 17:00 verrouillée.
 */
export function isOrderEditable(
  deliveryDate: DeliveryDateInput,
  now: Date,
  cutoffTime: string,
  timeZone: string
): boolean {
  return now.getTime() < orderCutoffInstant(deliveryDate, cutoffTime, timeZone).getTime();
}

/** Premier jour commandable : demain dans le fuseau de l'entreprise (RG-02 : J+1 ou plus tard). */
export function firstOrderableDate(now: Date, timeZone: string): string {
  return formatCalendarDate(addCalendarDays(zonedTodayDate(now, timeZone), 1));
}

/**
 * Première date encore ouverte à la commande : demain si son heure limite n'est pas passée,
 * sinon après-demain (RG-01, RG-02).
 */
export function firstOpenDeliveryDate(now: Date, cutoffTime: string, timeZone: string): string {
  const tomorrow = firstOrderableDate(now, timeZone);
  if (isOrderEditable(tomorrow, now, cutoffTime, timeZone)) return tomorrow;
  return formatCalendarDate(addCalendarDays(parseCalendarDate(tomorrow)!, 1));
}

/** Aujourd'hui dans le fuseau de l'entreprise (AAAA-MM-JJ). */
export function companyToday(now: Date, timeZone: string): string {
  return formatCalendarDate(zonedTodayDate(now, timeZone));
}

/**
 * RG-02 et RG-03 : la date doit être demain ou plus tard (jamais aujourd'hui ni le passé), tous
 * les jours de la semaine. L'heure limite reste à vérifier avec `isOrderEditable`.
 */
export function isDeliveryDateOrderable(deliveryDate: DeliveryDateInput, now: Date, timeZone: string): boolean {
  const day = toCalendarDate(deliveryDate);
  if (!day) return false;
  return formatCalendarDate(day) >= firstOrderableDate(now, timeZone);
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date de livraison. */
export function isoWeekday(deliveryDate: DeliveryDateInput): number {
  const day = toCalendarDate(deliveryDate);
  if (!day) throw new Error("INVALID_DELIVERY_DATE");
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}
