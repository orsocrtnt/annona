import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../src/services/prisma/client";
import { ACCOUNTING_EXPORT_COLUMNS, accountingDocumentRows, exportAccountingCsv } from "../src/domains/invoice/accounting-export.service";
import { buildInvoiceLineItems, computeInvoiceTotal } from "../src/domains/invoice/invoice.service";
import * as validation from "../src/lib/validations/accounting-export";
import { createOrderInvoiceSchema } from "../src/lib/validations/invoice";
import { generateInvoicePdf } from "../src/lib/pdf/invoice-pdf";
import { PDFDocument } from "pdf-lib";
import * as rbac from "../src/lib/permissions/rbac";

const query: validation.AccountingExportQuery = { from: "2026-10-01", to: "2026-10-31", status: "ALL" };
function document(index = 0, companyId = "A") {
  return { id: `doc-${String(index).padStart(5, "0")}`, reference: `DOC-${index}`, companyId,
    orderId: "order", customerId: null, status: "PENDING" as InvoiceStatus, amount: new Prisma.Decimal("0.30"),
    lineItems: [{ label: "Livraison éè漢字", amount: 0.1, quantity: 3, sourceType: "CUSTOM" }],
    createdAt: new Date("2026-10-25T23:30:00Z"), updatedAt: new Date("2026-10-25T23:30:00Z"),
    dueDate: null, paidAt: null, pdfUrl: null, notes: null, order: { companyId, reference: "ORDER-REF", customerEmail: "client@example.invalid" }, customer: null };
}
function transactionMock(t: TestContext, findMany: (args: Prisma.InvoiceFindManyArgs) => unknown) {
  const original = prisma.$transaction;
  Reflect.set(prisma, "$transaction", async (callback: (tx: unknown) => unknown, options: unknown) => {
    assert.equal((options as { isolationLevel: string }).isolationLevel, "RepeatableRead");
    return callback({ invoice: { findMany } });
  });
  t.after(() => Reflect.set(prisma, "$transaction", original));
}

test("BILL-01B exige dates calendaires UTC et statut explicites ; rejette pagination et doublons", () => {
  assert.equal(validation.parseAccountingExportQuery("http://test?from=2026-10-01&to=2026-10-31&status=ALL").success, true);
  for (const suffix of ["", "from=2026-02-30&to=2026-03-01&status=ALL", "from=2026-11-01&to=2026-10-01&status=ALL",
    "from=2026-10-01&to=2026-10-31&status=ALL&page=2", "from=2026-10-01&to=2026-10-31&status=ALL&status=PAID",
    "from=2026-10-01&to=2026-10-31&status=UNKNOWN"]) {
    assert.equal(validation.parseAccountingExportQuery(`http://test?${suffix}`).success, false);
  }
});

test("BILL-01B décimaux exacts, TVA demi-centime arrondie et entrées monétaires bornées", () => {
  assert.equal(computeInvoiceTotal([{ label: "x", amount: 0.1, quantity: 3, sourceType: "CUSTOM" }]), 0.3);
  const input = createOrderInvoiceSchema.parse({ customLines: [{ label: "A", amount: 0.05 }] });
  const lines = buildInvoiceLineItems({ items: [] }, input, 10);
  assert.equal(lines.at(-1)?.amount, 0.01);
  assert.equal(computeInvoiceTotal(lines), 0.06);
  for (const amount of [0.001, Infinity, NaN, -1, 100_000_000]) {
    assert.equal(createOrderInvoiceSchema.safeParse({ customLines: [{ label: "x", amount }] }).success, false);
  }
});

test("BILL-01B lignes enregistrées stables, colonnes constantes, document total distinct du détail", () => {
  const row = document();
  const first = accountingDocumentRows(row, "A", query);
  assert.equal(first.length, 2);
  assert.match(first[0]!, /"DOCUMENT"/);
  assert.match(first[0]!, /"0.30","SAVED_LINES","0.00"/);
  assert.match(first[1]!, /"3","0.1","0.30"$/);
  assert.equal(first[0]!.split(",").length, ACCOUNTING_EXPORT_COLUMNS.length);
  assert.deepEqual(accountingDocumentRows(row, "A", query), first);
  const changed = accountingDocumentRows({ ...row, status: "PAID", paidAt: new Date("2026-10-26Z") }, "A", query);
  assert.notEqual(changed[0], first[0]);
  assert.match(first[1]!, /éè漢字/);
  for (const foreign of [{ ...row, companyId: "B" }, { ...row, order: { ...row.order, companyId: "B" } },
    { ...row, customer: { companyId: "B" } }]) {
    assert.throws(() => accountingDocumentRows(foreign, "A", query), /INCONSISTENT/);
  }
});

test("BILL-01B annulations sans faux avoir ; anciennes lignes absentes, invalides et divergentes explicites", () => {
  const row = document();
  assert.match(accountingDocumentRows({ ...row, status: "CANCELLED" }, "A", query)[0]!, /"CANCELLED".*"0.30"/);
  assert.match(accountingDocumentRows({ ...row, lineItems: [] }, "A", query)[0]!, /"TOTAL_ONLY"/);
  assert.match(accountingDocumentRows({ ...row, lineItems: { invalid: true } }, "A", query)[0]!, /"INVALID_LINES"/);
  assert.match(accountingDocumentRows({ ...row, amount: new Prisma.Decimal("1") }, "A", query)[0]!, /"TOTAL_MISMATCH","0.70"/);
});

test("BILL-01B CSV protège formules, contrôles initiaux, guillemets et retours ligne", () => {
  for (const label of ["=1+1", "  +1", "\t@SUM(1)", "\r-1"]) {
    const row = document(); row.lineItems[0]!.label = label;
    assert.ok(accountingDocumentRows(row, "A", query)[1]!.includes(`"'${label}"`));
  }
  const row = document(); row.lineItems[0]!.label = 'Paris,"été"\r\nLyon';
  assert.ok(accountingDocumentRows(row, "A", query)[1]!.includes('"Paris,""été""\r\nLyon"'));
});

test("BILL-01B relevé opérationnel long paginé sans crash Unicode", async () => {
  const bytes = await generateInvoicePdf({ reference: "TEST-LONG", status: "PENDING", createdAt: new Date("2026-10-25Z"),
    amount: 48, company: { name: "Entreprise fictive" },
    lineItems: Array.from({ length: 160 }, (_, index) => ({ label: `Ligne ${index} — été 漢字 ${"adresse longue ".repeat(8)}`, amount: 0.1, quantity: 3 })),
    notes: "Note longue\n".repeat(100) });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 8);
  assert.ok(pdf.getPages().every((page) => page.getWidth() === 595 && page.getHeight() === 842));
});

test("BILL-01B export 1 001 documents par lots sans doublon, snapshot cohérent et filtre UTC inclusif", async (t) => {
  const dataset = Array.from({ length: 1001 }, (_, i) => document(i));
  let calls = 0;
  transactionMock(t, async (args) => {
    calls++;
    assert.equal(args.where?.companyId, "A");
    assert.equal(args.take, 250);
    assert.deepEqual(args.orderBy, { id: "asc" });
    assert.equal(args.where?.status, "PAID");
    const dates = args.where?.createdAt as Prisma.DateTimeFilter;
    assert.equal((dates.gte as Date).toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal((dates.lt as Date).toISOString(), "2026-11-01T00:00:00.000Z");
    const after = (args.where?.id as { gt?: string } | undefined)?.gt;
    return dataset.filter((row) => !after || row.id > after).slice(0, 250);
  });
  const first = await exportAccountingCsv("A", { ...query, status: "PAID" });
  const second = await exportAccountingCsv("A", { ...query, status: "PAID" });
  assert.equal(first, second);
  assert.equal(calls, 10);
  assert.ok(first.startsWith("\uFEFFschema_version,"));
  assert.equal(first.split("\r\n").filter(Boolean).length, 2003);
  assert.equal((first.match(/"DOCUMENT"/g) ?? []).length, 1001);
});

test("BILL-01B vide valide, volume refusé sans fichier partiel et scope vide refusé", async (t) => {
  let dataset: ReturnType<typeof document>[] = [];
  transactionMock(t, async (args) => {
    const after = (args.where?.id as { gt?: string } | undefined)?.gt;
    return dataset.filter((row) => !after || row.id > after).slice(0, 250);
  });
  assert.equal((await exportAccountingCsv("A", query)).split("\r\n").filter(Boolean).length, 1);
  dataset = Array.from({ length: 10_001 }, (_, i) => document(i));
  await assert.rejects(exportAccountingCsv("A", query), /TOO_LARGE/);
  await assert.rejects(exportAccountingCsv("", query), /SCOPE_REQUIRED/);
});

test("BILL-01B route exige invoices:read, refuse entreprise absente, erreurs sans contenu et téléchargement privé", async () => {
  let allowed = false; let companyId: string | null = "A"; let calls = 0; let fail = "";
  const sandboxModule = { exports: {} };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": { requireStaffRole: async (permission: string) => {
      assert.equal(permission, "invoices:read"); return allowed ? { context: {} } : { error: NextResponse.json({}, { status: 403 }) };
    }, getCompanyId: () => companyId, requireRole: () => null },
    "@/lib/validations/accounting-export": validation,
    "@/domains/invoice/accounting-export.service": { exportAccountingCsv: async (scope: string) => {
      calls++; assert.equal(scope, "A"); if (fail) throw new Error(fail); return "csv";
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync("src/app/api/invoices/export/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: sandboxModule, exports: sandboxModule.exports, require: (id: string) => deps[id], Response, Error });
  const route = sandboxModule.exports as { GET: (request: Request) => Promise<Response> };
  const request = () => new Request("http://test?from=2026-10-01&to=2026-10-31&status=ALL");
  assert.equal((await route.GET(request())).status, 403); assert.equal(calls, 0);
  allowed = true; companyId = null;
  assert.equal((await route.GET(request())).status, 403); assert.equal(calls, 0);
  companyId = "A";
  assert.equal((await route.GET(new Request("http://test"))).status, 400); assert.equal(calls, 0);
  const success = await route.GET(request());
  assert.equal(success.status, 200); assert.equal(success.headers.get("Cache-Control"), "private, no-store");
  assert.match(success.headers.get("Content-Disposition")!, /prestations-v1/);
  fail = "ACCOUNTING_EXPORT_TOO_LARGE"; assert.equal((await route.GET(request())).status, 422);
  fail = "secret-other-tenant"; const error = await route.GET(request());
  assert.equal(error.status, 503); assert.ok(!(await error.text()).includes(fail));
});

test("BILL-01B vraie garde serveur : anonyme, client, livreur et mini-admin commandes refusés", async () => {
  let session: unknown = null;
  function load(file: string, deps: Record<string, unknown>) {
    const sandboxModule = { exports: {} };
    runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { module: sandboxModule, exports: sandboxModule.exports, Response, Error, require: (id: string) => {
      assert.ok(id in deps, id); return deps[id];
    } });
    return sandboxModule.exports;
  }
  const guard = load("src/lib/api/auth-guard.ts", {
    "server-only": {}, "next/server": { NextResponse }, "@/lib/permissions/rbac": rbac,
    "./server-auth": { getServerAuth: async () => session },
  });
  let calls = 0;
  const route = load("src/app/api/invoices/export/route.ts", {
    "next/server": { NextResponse }, "@/lib/api/auth-guard": guard,
    "@/lib/validations/accounting-export": validation,
    "@/domains/invoice/accounting-export.service": { exportAccountingCsv: async (companyId: string) => {
      calls++; assert.equal(companyId, "A"); return "csv";
    } },
  }) as { GET: (request: Request) => Promise<Response> };
  const request = () => new Request("http://test?from=2026-10-01&to=2026-10-31&status=ALL");
  assert.equal((await route.GET(request())).status, 401);
  for (const role of ["CLIENT", "DRIVER", "MINI_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]) {
    session = { permissions: role === "MINI_ADMIN" ? ["orders:read"] : ["invoices:read"], user: { companyId: "A", role: { systemRole: role } } };
    const response = await route.GET(request());
    assert.equal(response.status, ["CLIENT", "DRIVER", "MINI_ADMIN", "DISPATCHER"].includes(role) ? 403 : 200);
  }
  session = { permissions: ["invoices:read"], user: { companyId: null, role: { systemRole: "SUPER_ADMIN" } } };
  assert.equal((await route.GET(request())).status, 403);
  assert.equal(calls, 1);
});
