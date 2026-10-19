import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../../src/services/prisma/client";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { exportAccountingCsv } from "../../src/domains/invoice/accounting-export.service";
import { computeInvoiceTotal } from "../../src/domains/invoice/invoice.service";

const key = `bill01b-${randomUUID()}`;
const companies: string[] = [];
const orders: string[] = [];
const query = { from: "2026-10-25", to: "2026-10-25", status: "ALL" as const };

// Independent CSV reader: embedded CR/LF and escaped quotes are data, not records.
function parseCsv(csv: string) {
  const records: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = csv.charCodeAt(0) === 0xfeff ? 1 : 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if (char === "\r" && csv[i + 1] === "\n" && !quoted) {
      row.push(cell); records.push(row); row = []; cell = ""; i++;
    } else cell += char;
  }
  assert.equal(quoted, false); assert.equal(cell, ""); assert.equal(row.length, 0);
  const header = records.shift()!;
  return records.map((record) => {
    assert.equal(record.length, header.length);
    return Object.fromEntries(header.map((name, index) => [name, record[index]!]));
  });
}

async function fingerprint() {
  const rows = await Promise.all([
    prisma.company.findMany({ where: { id: { notIn: companies } }, select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.order.findMany({ where: { companyId: { notIn: companies } }, select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.invoice.findMany({ where: { companyId: { notIn: companies } }, select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
  ]);
  return { counts: rows.map((group) => group.length), sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}

async function main() {
  const baseline = await fingerprint();
  let evidence: Record<string, unknown> | undefined;
  try {
    for (const suffix of ["a", "b"]) {
      const company = await prisma.company.create({ data: { slug: `${key}-${suffix}`, name: `BILL-01B fictive ${suffix}`, isDemo: true } });
      companies.push(company.id);
      const order = await prisma.order.create({ data: { reference: `${key}-${suffix}`, companyId: company.id,
        status: "DELIVERED", totalAmount: "0.30", notes: key } });
      orders.push(order.id);
    }
    const [a, b] = companies as [string, string];
    const statuses: InvoiceStatus[] = ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"];
    const labels = ['Paris,"été"\r\nLyon 漢字', "=1+1", "  +SUM(1)", "\t@FORMULE", "-DANGEREUX"];
    const data = Array.from({ length: 1001 }, (_, index) => ({
      reference: `${key}-A-${index}`, companyId: a, orderId: orders[0], status: statuses[index % 5]!,
      amount: new Prisma.Decimal("0.30"),
      lineItems: [{ label: labels[index % labels.length]!, amount: 0.1, quantity: 3, sourceType: "CUSTOM" }],
      createdAt: new Date(index % 2 === 0 ? "2026-10-25T00:00:00.000Z" : "2026-10-25T23:59:59.999Z"),
    }));
    await prisma.invoice.createMany({ data });
    await prisma.invoice.createMany({ data: [
      { reference: `${key}-before`, companyId: a, amount: "8", createdAt: new Date("2026-10-24T23:59:59.999Z") },
      { reference: `${key}-after`, companyId: a, amount: "9", createdAt: new Date("2026-10-26T00:00:00.000Z") },
      { reference: `${key}-B`, companyId: b, orderId: orders[1], amount: "99", createdAt: new Date("2026-10-25T12:00:00Z") },
    ] });
    const first = await exportAccountingCsv(a, query);
    const second = await exportAccountingCsv(a, query);
    assert.equal(first, second);
    const rows = parseCsv(first);
    const documents = rows.filter((row) => row.record_type === "DOCUMENT");
    const lines = rows.filter((row) => row.record_type === "LINE");
    assert.equal(documents.length, 1001); assert.equal(lines.length, 1001);
    assert.equal(new Set(documents.map((row) => row.document_id)).size, 1001);
    assert.ok(rows.every((row) => row.company_id === a && row.order_id === orders[0]));
    assert.ok(rows.every((row) => !row.document_reference!.includes("-B") && !row.document_reference!.includes("-before") && !row.document_reference!.includes("-after")));
    assert.ok(lines.some((row) => row.label === labels[0]));
    assert.ok(lines.some((row) => row.label === "'=1+1"));
    assert.ok(lines.some((row) => row.label === "'\t@FORMULE"));
    assert.ok(documents.every((row) => row.document_total === "0.30" && row.detail_quality === "SAVED_LINES"));
    assert.equal(documents.reduce((sum, row) => sum.plus(row.document_total!), new Prisma.Decimal(0)).toFixed(2), "300.30");
    for (const status of statuses) {
      const filtered = parseCsv(await exportAccountingCsv(a, { ...query, status }));
      assert.equal(filtered.filter((row) => row.record_type === "DOCUMENT").length, status === "DRAFT" ? 201 : 200);
      assert.ok(filtered.every((row) => row.document_status === status));
    }
    const foreign = parseCsv(await exportAccountingCsv(b, query));
    assert.equal(foreign.length, 1); assert.equal(foreign[0]?.document_total, "99.00");
    // Current tariff/company metadata cannot rewrite saved prices or exported identity fields.
    await prisma.company.update({ where: { id: a }, data: { name: "BILL-01B nouveau nom", settings: { tariffZones: [{ id: "new", price: 999 }] } } });
    assert.equal(await exportAccountingCsv(a, query), first);
    const last = await prisma.invoice.findFirstOrThrow({ where: { companyId: a, createdAt: { gte: new Date("2026-10-25Z"), lt: new Date("2026-10-26Z") } }, orderBy: { id: "desc" } });
    const transaction = prisma.$transaction.bind(prisma);
    let externallyUpdated = false;
    Reflect.set(prisma, "$transaction", (callback: (tx: unknown) => Promise<unknown>, options: unknown) => transaction(async (tx) => {
      return callback({ invoice: { findMany: async (args: Prisma.InvoiceFindManyArgs) => {
        const page = await tx.invoice.findMany(args);
        if (!externallyUpdated) {
          externallyUpdated = true;
          await prisma.invoice.update({ where: { id: last.id }, data: { amount: "42" } });
        }
        return page;
      } } });
    }, options as { isolationLevel: Prisma.TransactionIsolationLevel; maxWait: number; timeout: number }));
    try {
      assert.equal(await exportAccountingCsv(a, query), first);
      assert.equal(externallyUpdated, true);
    } finally {
      Reflect.set(prisma, "$transaction", transaction);
      await prisma.invoice.update({ where: { id: last.id }, data: { amount: last.amount, updatedAt: last.updatedAt } });
    }
    const changed = await prisma.invoice.findFirstOrThrow({ where: { companyId: a, status: "PENDING" } });
    await prisma.invoice.update({ where: { id: changed.id }, data: { amount: "0.50", lineItems: [{ label: "Révision", amount: 0.5, quantity: 1, sourceType: "CUSTOM" }] } });
    const revised = parseCsv(await exportAccountingCsv(a, query)).find((row) => row.record_type === "DOCUMENT" && row.document_id === changed.id)!;
    assert.notEqual(revised.document_version_sha256, documents.find((row) => row.document_id === changed.id)!.document_version_sha256);
    // Corrupt cross-tenant references are refused, including the foreign order identifier.
    await prisma.invoice.update({ where: { id: changed.id }, data: { orderId: orders[1] } });
    await assert.rejects(exportAccountingCsv(a, query), /INCONSISTENT/);
    await prisma.invoice.update({ where: { id: changed.id }, data: { orderId: orders[0] } });
    assert.equal(computeInvoiceTotal([{ label: "x", amount: 0.1, quantity: 3, sourceType: "CUSTOM" }]), 0.3);
    assert.deepEqual(await fingerprint(), baseline);
    evidence = { task: "BILL-01B", passed: true, documentsA: 1001, documentsB: 1, linesA: 1001,
      totalA: "300.30", batchSize: 250, exportSha256: createHash("sha256").update(first).digest("hex"),
      doubleExportIdentical: true, utcBothDayEdgesIncluded: true, utcAdjacentDaysExcluded: true,
      allFiveStatusesFiltered: true, cancelledNotConvertedToCreditNote: true,
      unicodeQuotesNewlinesAndFormulaProtection: true, currentTariffsAndCompanyNameIndependent: true,
      pendingRevisionChangesDocumentVersion: true, corruptForeignReferenceRejected: true,
      concurrentEditBetweenPagesKeepsOriginalSnapshot: true,
      preexistingFingerprintUnchanged: true, boundaries: "domain-and-database; HTTP guard covered by local tests" };
  } finally {
    // Exact IDs created by this run only; no prefix-wide cleanup, Auth, files or jobs.
    if (companies.length) {
      await prisma.invoice.deleteMany({ where: { companyId: { in: companies } } });
      await prisma.order.deleteMany({ where: { companyId: { in: companies } } });
      await prisma.company.deleteMany({ where: { id: { in: companies } } });
    }
  }
  const residue = await Promise.all([
    prisma.company.count({ where: { id: { in: companies } } }),
    prisma.order.count({ where: { companyId: { in: companies } } }),
    prisma.invoice.count({ where: { companyId: { in: companies } } }),
  ]);
  assert.deepEqual(residue, [0, 0, 0]); assert.deepEqual(await fingerprint(), baseline);
  assert.ok(evidence);
  await mkdir("outputs/bill01b", { recursive: true });
  await writeFile("outputs/bill01b/connected.json", `${JSON.stringify({ ...evidence, residue, preexistingCounts: baseline.counts }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, residue }));
}

main().catch(() => { console.error("BILL01B_CONNECTED_FAILED (no sensitive diagnostic)"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
