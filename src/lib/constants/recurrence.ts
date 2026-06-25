import type { RecurrenceUnit } from "@prisma/client";

export const RECURRENCE_UNIT_LABELS: Record<RecurrenceUnit, string> = {
  DAYS: "jour(s)",
  WEEKS: "semaine(s)",
  MONTHS: "mois",
};

export function formatRecurrenceInterval(value: number, unit: RecurrenceUnit): string {
  if (value === 1 && unit === "MONTHS") return "Chaque mois";
  if (value === 1 && unit === "WEEKS") return "Chaque semaine";
  if (value === 1 && unit === "DAYS") return "Chaque jour";
  return `Tous les ${value} ${RECURRENCE_UNIT_LABELS[unit]}`;
}
