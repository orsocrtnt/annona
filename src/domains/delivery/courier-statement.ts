import { z } from "zod";

/** Une course terminée (livrée ou en échec) attribuée à un livreur. */
export type CourierStatementRow = {
  deliveryId: string;
  reference: string;
  driverId: string;
  driverName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  address: string | null;
  city: string | null;
};

export type CourierStatementLine = {
  deliveryId: string;
  reference: string;
  outcome: "DELIVERED" | "FAILED";
  startedAt: Date | null;
  completedAt: Date | null;
  durationMinutes: number | null;
  address: string;
};

export type CourierStatementCourier = {
  driverId: string;
  driverName: string;
  delivered: number;
  failed: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number | null;
  rows: CourierStatementLine[];
};

export type CourierStatement = { couriers: CourierStatementCourier[] };

const MAX_PERIOD_DAYS = 93;

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const courierStatementQuerySchema = z
  .object({
    from: z.string().refine(validDay, "Date de début invalide (AAAA-MM-JJ)"),
    to: z.string().refine(validDay, "Date de fin invalide (AAAA-MM-JJ)"),
    driverId: z.string().min(1).max(64).optional(),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .superRefine((value, context) => {
    if (!validDay(value.from) || !validDay(value.to)) return;
    const days = (Date.parse(value.to) - Date.parse(value.from)) / 86_400_000;
    if (days < 0) context.addIssue({ code: "custom", message: "La fin précède le début", path: ["to"] });
    else if (days > MAX_PERIOD_DAYS) {
      context.addIssue({ code: "custom", message: `Période limitée à ${MAX_PERIOD_DAYS} jours`, path: ["to"] });
    }
  });

function parisOffsetMs(instant: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

/** Minuit (heure de Paris) du jour AAAA-MM-JJ, en instant UTC. */
export function parisDayStart(day: string): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(year, month - 1, date);
  return new Date(guess - parisOffsetMs(guess - parisOffsetMs(guess)));
}

function minutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return minutes >= 0 ? minutes : null;
}

export function buildCourierStatement(rows: CourierStatementRow[]): CourierStatement {
  const couriers = new Map<string, CourierStatementCourier>();
  for (const row of rows) {
    const courier = couriers.get(row.driverId) ?? {
      driverId: row.driverId, driverName: row.driverName, delivered: 0, failed: 0,
      totalDurationMinutes: 0, averageDurationMinutes: null, rows: [],
    };
    const outcome = row.status === "FAILED" ? "FAILED" : "DELIVERED";
    const durationMinutes = minutesBetween(row.startedAt, row.completedAt);
    if (outcome === "FAILED") courier.failed += 1;
    else courier.delivered += 1;
    if (durationMinutes != null) courier.totalDurationMinutes += durationMinutes;
    courier.rows.push({
      deliveryId: row.deliveryId, reference: row.reference, outcome, startedAt: row.startedAt,
      completedAt: row.completedAt, durationMinutes,
      address: [row.address, row.city].filter(Boolean).join(", "),
    });
    couriers.set(row.driverId, courier);
  }
  for (const courier of couriers.values()) {
    const measured = courier.rows.filter((line) => line.durationMinutes != null).length;
    courier.averageDurationMinutes = measured ? Math.round(courier.totalDurationMinutes / measured) : null;
  }
  return { couriers: [...couriers.values()].sort((a, b) => a.driverName.localeCompare(b.driverName, "fr")) };
}

function parisDateTime(value: Date | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Cellule CSV : neutralise les formules (=, +, -, @) et protège séparateurs, guillemets et retours à la ligne. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV pour tableur français : BOM UTF-8, séparateur point-virgule, heures de Paris. */
export function courierStatementToCsv(statement: CourierStatement): string {
  const lines = [["Livreur", "Référence", "Résultat", "Prise en charge", "Livraison", "Durée (min)", "Adresse"].join(";")];
  for (const courier of statement.couriers) {
    for (const line of courier.rows) {
      lines.push(
        [
          courier.driverName, line.reference, line.outcome === "FAILED" ? "Échec" : "Livrée",
          parisDateTime(line.startedAt), parisDateTime(line.completedAt),
          line.durationMinutes == null ? "" : String(line.durationMinutes), line.address,
        ].map(csvCell).join(";")
      );
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
