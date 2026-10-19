import type { RecurrenceUnit } from "@prisma/client";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Les récurrences sont des dates calendaires, pas des heures locales.
 * Elles sont donc conservées et calculées en UTC pour rester identiques quel
 * que soit le fuseau du serveur qui exécute le cron.
 */
export function parseRecurringCalendarDate(value: string, endOfDay = false) {
  const match = CALENDAR_DATE.exec(value);
  if (!match) throw new Error("INVALID_RECURRING_CALENDAR_DATE");

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(
    Date.UTC(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("INVALID_RECURRING_CALENDAR_DATE");
  }
  return date;
}

export function recurringCalendarDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function targetMonth(year: number, month: number, delta: number) {
  const absoluteMonth = year * 12 + month + delta;
  return {
    year: Math.floor(absoluteMonth / 12),
    month: ((absoluteMonth % 12) + 12) % 12,
  };
}

/**
 * L'ancre conserve le jour choisi au départ. Ainsi une récurrence commencée
 * le 31 produit le dernier jour de février, puis revient au 31 en mars.
 */
export function addRecurringInterval(
  date: Date,
  value: number,
  unit: RecurrenceUnit,
  anchor: Date = date
) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("INVALID_RECURRING_INTERVAL");
  }

  const next = new Date(date.getTime());
  if (unit === "DAYS") {
    next.setUTCDate(next.getUTCDate() + value);
    return next;
  }
  if (unit === "WEEKS") {
    next.setUTCDate(next.getUTCDate() + value * 7);
    return next;
  }

  const target = targetMonth(date.getUTCFullYear(), date.getUTCMonth(), value);
  const lastDay = new Date(Date.UTC(target.year, target.month + 1, 0)).getUTCDate();
  next.setUTCFullYear(target.year, target.month, Math.min(anchor.getUTCDate(), lastDay));
  return next;
}
