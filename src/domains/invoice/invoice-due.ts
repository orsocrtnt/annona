import type { InvoiceStatus } from "@prisma/client";

/**
 * Échéance des factures de livraison (DEMO-3). Une facture est en retard à partir
 * du lendemain de son jour d'échéance, lu à Paris : échue le 27, elle passe en
 * retard le 28 à 0 h (heure de Paris). Le nombre de jours de retard compte des
 * jours calendaires.
 */
const TIME_ZONE = "Europe/Paris";
const DAY_MS = 86_400_000;
const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: TIME_ZONE });
const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Statuts encore à régler : seuls ceux-ci peuvent passer en retard, être payés ou relancés. */
export const OUTSTANDING_INVOICE_STATUSES = ["PENDING", "OVERDUE"] as const satisfies readonly InvoiceStatus[];

export function isInvoiceOutstanding(status: InvoiceStatus | string): boolean {
  return (OUTSTANDING_INVOICE_STATUSES as readonly string[]).includes(status);
}

function parisDayStartUtc(date: Date) {
  return Date.parse(`${dayKey.format(date)}T00:00:00Z`);
}

function parisOffsetMs(at: Date) {
  const parts = Object.fromEntries(wallClock.formatToParts(at).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC du minuit de Paris du jour de `now` : une échéance antérieure est dépassée. */
export function startOfParisDay(now: Date): Date {
  const midnightAsUtc = parisDayStartUtc(now);
  return new Date(midnightAsUtc - parisOffsetMs(new Date(midnightAsUtc)));
}

export function invoiceDaysOverdue(dueDate: Date | null, now: Date): number {
  if (!dueDate) return 0;
  return Math.max(0, Math.round((parisDayStartUtc(now) - parisDayStartUtc(dueDate)) / DAY_MS));
}
