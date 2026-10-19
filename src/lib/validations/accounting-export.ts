import { z } from "zod";

const utcDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date invalide");

export const accountingExportQuerySchema = z.object({
  from: utcDay,
  to: utcDay,
  status: z.enum(["ALL", "DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]),
}).strict().refine((value) => value.from <= value.to, "Période inversée");

export type AccountingExportQuery = z.infer<typeof accountingExportQuerySchema>;

export function parseAccountingExportQuery(url: string) {
  const params = new URL(url).searchParams;
  // Reject duplicates and unknown parameters rather than silently ignoring filters.
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return accountingExportQuerySchema.safeParse({});
  }
  return accountingExportQuerySchema.safeParse(Object.fromEntries(entries));
}
