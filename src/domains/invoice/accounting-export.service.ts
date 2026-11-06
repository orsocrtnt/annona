import { createHash } from "node:crypto";
import { Prisma, type Invoice } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import type { AccountingExportQuery } from "@/lib/validations/accounting-export";

export const ACCOUNTING_EXPORT_VERSION = "annona-delivery-v1";
export const ACCOUNTING_EXPORT_BATCH_SIZE = 250;
export const ACCOUNTING_EXPORT_MAX_DOCUMENTS = 10_000;
export const ACCOUNTING_EXPORT_MAX_ROWS = 50_000;
export const ACCOUNTING_EXPORT_MAX_BYTES = 20 * 1024 * 1024;
export const ACCOUNTING_EXPORT_COLUMNS = [
  "schema_version", "record_type", "company_id", "document_id", "document_reference",
  "document_version_sha256", "created_at_utc", "updated_at_utc", "due_at_utc", "paid_at_utc",
  "period_from_utc", "period_to_utc_inclusive", "status_filter", "document_status",
  "order_id", "customer_id", "order_reference", "order_customer_email", "currency", "document_total", "detail_quality",
  "detail_total_difference", "line_number", "source_type", "source_id", "label",
  "quantity", "unit_amount", "line_total",
] as const;

type ExportInvoice = Invoice & {
  order: { companyId: string; reference: string; customerEmail: string | null } | null;
  customer: { companyId: string | null } | null;
};

function csvCell(value: unknown, literalText = true): string {
  const raw = String(value ?? "");
  // Text remains literal in spreadsheet software, including leading controls/spaces.
  const safe = literalText && (/^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) || /^[\t\r\n]/.test(raw)) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

type Line = { label: string; amount: Prisma.Decimal; quantity: number; sourceType: string; sourceId: string };
function readLines(value: Prisma.JsonValue): Line[] | null {
  if (!Array.isArray(value)) return null;
  const lines: Line[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const { label, amount, quantity, sourceType, sourceId } = candidate;
    if (typeof label !== "string" || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 ||
      typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 ||
      typeof sourceType !== "string" || !["ZONE", "FEE", "PURCHASE", "CUSTOM", "VAT"].includes(sourceType) ||
      (sourceId != null && typeof sourceId !== "string")) return null;
    lines.push({ label, amount: new Prisma.Decimal(String(amount)), quantity, sourceType, sourceId: sourceId ?? "" });
  }
  return lines;
}

/** Uses only saved document fields: never recalculates old prices from current tariffs. */
export function accountingDocumentRows(invoice: ExportInvoice, companyId: string, query: AccountingExportQuery): string[] {
  if (invoice.companyId !== companyId || (invoice.order && invoice.order.companyId !== companyId) ||
    (invoice.customer && invoice.customer.companyId !== companyId)) throw new Error("ACCOUNTING_EXPORT_INCONSISTENT");
  const amount = new Prisma.Decimal(invoice.amount);
  if (!amount.isFinite() || amount.isNegative()) throw new Error("ACCOUNTING_EXPORT_INCONSISTENT");
  const lines = readLines(invoice.lineItems);
  const detailTotal = lines?.reduce((sum, line) => sum.plus(line.amount.times(line.quantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)), new Prisma.Decimal(0));
  const difference = detailTotal == null ? null : amount.minus(detailTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const quality = !lines ? "INVALID_LINES" : lines.length === 0 ? "TOTAL_ONLY" : !difference?.isZero() ? "TOTAL_MISMATCH" : "SAVED_LINES";
  const common = [
    ACCOUNTING_EXPORT_VERSION, "", companyId, invoice.id, invoice.reference,
    createHash("sha256").update(JSON.stringify([
      invoice.id, invoice.reference, invoice.companyId, invoice.orderId, invoice.customerId,
      invoice.status, amount.toFixed(2), invoice.lineItems, invoice.createdAt.toISOString(),
      invoice.updatedAt.toISOString(), invoice.dueDate?.toISOString() ?? null, invoice.paidAt?.toISOString() ?? null,
      invoice.order?.reference ?? null, invoice.order?.customerEmail ?? null,
    ])).digest("hex"),
    invoice.createdAt.toISOString(), invoice.updatedAt.toISOString(), invoice.dueDate?.toISOString() ?? "",
    invoice.paidAt?.toISOString() ?? "", query.from, query.to, query.status, invoice.status,
    invoice.orderId ?? "", invoice.customerId ?? "", invoice.order?.reference ?? "", invoice.order?.customerEmail ?? "", "EUR",
  ];
  const numericColumns = new Set(["document_total", "detail_total_difference", "line_number", "quantity", "unit_amount", "line_total"]);
  const serialize = (row: unknown[]) => row.map((value, index) => csvCell(value, !numericColumns.has(ACCOUNTING_EXPORT_COLUMNS[index]!))).join(",");
  const document = [...common, amount.toFixed(2), quality, difference?.toFixed(2) ?? "", "", "", "", "", "", "", ""];
  document[1] = "DOCUMENT";
  return [serialize(document), ...(lines ?? []).map((line, index) => {
    const row = [...common, "", "", "", index + 1, line.sourceType, line.sourceId, line.label,
      line.quantity, line.amount.toString(), line.amount.times(line.quantity).toFixed(2, Prisma.Decimal.ROUND_HALF_UP)];
    row[1] = "LINE";
    return serialize(row);
  })];
}

export async function exportAccountingCsv(companyId: string, query: AccountingExportQuery): Promise<string> {
  if (!companyId) throw new Error("ACCOUNTING_EXPORT_SCOPE_REQUIRED");
  // All pages see the same PostgreSQL snapshot, even if a document changes mid-export.
  return prisma.$transaction(async (tx) => {
    const start = new Date(`${query.from}T00:00:00.000Z`);
    const end = new Date(`${query.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const rows = [ACCOUNTING_EXPORT_COLUMNS.join(",")];
    let cursor: string | undefined;
    let count = 0;
    let bytes = Buffer.byteLength(rows[0]!, "utf8") + 3;
    while (true) {
      const documents = await tx.invoice.findMany({
        where: { companyId, createdAt: { gte: start, lt: end }, ...(query.status === "ALL" ? {} : { status: query.status }),
          ...(cursor ? { id: { gt: cursor } } : {}) },
        include: { order: { select: { companyId: true, reference: true, customerEmail: true } }, customer: { select: { companyId: true } } },
        orderBy: { id: "asc" }, take: ACCOUNTING_EXPORT_BATCH_SIZE,
      });
      for (const document of documents) {
        if (++count > ACCOUNTING_EXPORT_MAX_DOCUMENTS) throw new Error("ACCOUNTING_EXPORT_TOO_LARGE");
        const additions = accountingDocumentRows(document, companyId, query);
        for (const row of additions) {
          bytes += Buffer.byteLength(row, "utf8") + 2;
          if (rows.length > ACCOUNTING_EXPORT_MAX_ROWS || bytes > ACCOUNTING_EXPORT_MAX_BYTES) throw new Error("ACCOUNTING_EXPORT_TOO_LARGE");
          rows.push(row);
        }
      }
      if (documents.length < ACCOUNTING_EXPORT_BATCH_SIZE) break;
      cursor = documents.at(-1)!.id;
    }
    return `\uFEFF${rows.join("\r\n")}\r\n`;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 60_000 });
}
