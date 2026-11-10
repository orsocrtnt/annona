import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// DATA-02 / SCHEMA-1 : contrat de l'export portable d'une entreprise (version 2, modèle boulangerie).
// Base simulée en mémoire : deux entreprises, l'export de A ne doit jamais rien lire ni écrire de B.

const servicePath = new URL("../src/domains/data-lifecycle/company-export.service.ts", import.meta.url);
const fixedNow = "2026-11-06T12:00:00.000Z";

type Row = Record<string, unknown>;
type QueryArgs = { where?: Row; take?: number; orderBy?: unknown; select?: Row; include?: Row };
type ExportVisitor = {
  start(header: unknown, company: unknown): Promise<void>;
  page(collection: string, rows: unknown[]): Promise<void>;
};
type Summary = { version: number; counts: Record<string, number>; externalAssets: { proofObjects: Array<Record<string, string>> } };
type ExportModule = {
  exportCompanyData(companyId: string, options?: { pageSize?: number }): Promise<(Summary & { data: Record<string, unknown> }) | null>;
  visitCompanyExport(companyId: string, visitor: ExportVisitor, options?: { pageSize?: number }): Promise<Summary | null>;
  createCompanyExportJsonWriter(write: (text: string) => Promise<void>): { visitor: ExportVisitor; finish(summary: unknown): Promise<void> };
};

class FixedDate extends Date {
  constructor(value?: string | number | Date) {
    super(value instanceof Date ? value.getTime() : value ?? fixedNow);
  }
  static override now() {
    return Date.parse(fixedNow);
  }
}

const COLLECTIONS = [
  "user", "merchant", "category", "product", "deliveryZone", "slot", "recurringOrder", "order", "round", "invoice", "supportTicket", "auditLog", "operationJob",
] as const;

/** Les objets venant du contexte vm n'ont pas les mêmes prototypes : comparaison par valeur JSON. */
function same(actual: unknown, expected: unknown, message?: string) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual ?? null)), JSON.parse(JSON.stringify(expected ?? null)), message);
}

function at(seconds: number) {
  return new Date(Date.parse("2026-11-01T08:00:00.000Z") + seconds * 1000);
}

/** Trois lignes par collection pour A (dont deux au même instant : le tri par id départage), une pour B. */
function makeRepository() {
  const calls: Array<{ model: string; args: QueryArgs }> = [];
  const records: Record<string, Row[]> = {};
  for (const model of COLLECTIONS) {
    records[model] = [
      { id: `${model}-a1`, companyId: "company-a", createdAt: at(1) },
      { id: `${model}-a3`, companyId: "company-a", createdAt: at(2) },
      { id: `${model}-a2`, companyId: "company-a", createdAt: at(2) },
      { id: `${model}-b1`, companyId: "company-b", createdAt: at(1), name: "FOREIGN_B_SENTINEL" },
    ];
  }
  for (const row of records.round!) {
    const own = row.companyId === "company-a";
    row.stops = [
      { id: `${row.id}-stop`, companyId: row.companyId, roundId: row.id, orderId: `order-of-${row.id}`, sequence: 1, incidentPhotoPath: own && row.id === "round-a1" ? `company-a/${row.id}-stop-1700000000000.jpg` : null },
    ];
  }
  for (const row of records.user!) row.notifications = [{ id: `${row.id}-n`, title: row.companyId === "company-b" ? "FOREIGN_B_SENTINEL" : "Commande livrée" }];
  for (const row of records.order!) row.lines = [{ id: `${row.id}-l` }, { id: `${row.id}-l2` }];
  for (const row of records.invoice!) Object.assign(row, { lines: [{ id: `${row.id}-l` }], payments: [] });
  for (const row of records.merchant!) row.prices = [{ id: `${row.id}-p` }];
  for (const row of records.supportTicket!) row.messages = [{ id: `${row.id}-m` }];

  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
      if (value && typeof value === "object" && !(value instanceof Date) && "gt" in value) {
        const bound = (value as { gt: unknown }).gt;
        return bound instanceof Date ? (row[key] as Date).getTime() > bound.getTime() : String(row[key]) > String(bound);
      }
      if (value instanceof Date) return (row[key] as Date).getTime() === value.getTime();
      return row[key] === value;
    });
  const sorted = (rows: Row[]) =>
    [...rows].sort((left, right) => (left.createdAt as Date).getTime() - (right.createdAt as Date).getTime() || String(left.id).localeCompare(String(right.id)));

  const tx: Record<string, unknown> = {
    company: {
      findUnique: async (args: QueryArgs) => {
        calls.push({ model: "company", args });
        const id = (args.where as { id: string }).id;
        return id === "company-a" ? { id, name: "Boulangerie A", settings: {}, createdAt: at(0), updatedAt: at(0) } : null;
      },
    },
  };
  for (const model of COLLECTIONS) {
    tx[model] = {
      findMany: async (args: QueryArgs) => {
        calls.push({ model, args });
        return sorted(records[model]!.filter((row) => matches(row, args.where ?? {}))).slice(0, args.take);
      },
    };
  }
  const prisma = {
    async $transaction(callback: (client: typeof tx) => Promise<unknown>, options: Row) {
      same(options, { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 600_000 });
      return callback(tx);
    },
  };
  return { calls, prisma };
}

function loadService(prisma: unknown): ExportModule {
  const compiled = ts.transpileModule(readFileSync(servicePath, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(compiled, {
    Date: FixedDate, Error, Boolean, Number, module, exports: module.exports,
    require(id: string) {
      if (id === "@prisma/client") return { Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } } };
      if (id === "@/services/prisma/client") return { prisma };
      throw new Error(`Dépendance inattendue dans l'export : ${id}`);
    },
  });
  return module.exports as ExportModule;
}

test("l'export v2 reste isolé à l'entreprise, complet, trié et sans champ interne", async () => {
  const { calls, prisma } = makeRepository();
  const result = await loadService(prisma).exportCompanyData("company-a");
  assert.ok(result);
  assert.equal(result.version, 2);
  assert.equal(JSON.stringify(result).includes("FOREIGN_B_SENTINEL"), false, "aucune donnée de l'entreprise B");
  same(Object.keys(result.data), [
    "company", "users", "merchants", "categories", "products", "deliveryZones", "slots", "recurringOrders", "orders", "rounds", "invoices", "supportTickets", "auditLogs", "operationJobs",
  ]);
  for (const call of calls.slice(1)) {
    same(call.args.where, { companyId: "company-a" }, `${call.model} borné à l'entreprise`);
    same(call.args.orderBy, [{ createdAt: "asc" }, { id: "asc" }], `${call.model} trié de façon stable`);
  }
  const users = calls.find((call) => call.model === "user")!.args.select!;
  for (const forbidden of ["authId", "password"]) assert.equal(forbidden in users, false, forbidden);
  same((users.role as { select: unknown }).select, { name: true, slug: true, systemRole: true });
  const jobs = calls.find((call) => call.model === "operationJob")!.args.select!;
  assert.equal("payload" in jobs || "lastError" in jobs, false, "tâche sans charge ni erreur");
  assert.equal(result.counts.orders, 3);
  assert.equal(result.counts.orderLines, 6);
  assert.equal(result.counts.stops, 3);
  assert.equal(result.counts.notifications, 3);
  assert.equal(result.counts.merchantPrices, 3);
  same(result.externalAssets.proofObjects, [
    { stopId: "round-a1-stop", orderId: "order-of-round-a1", objectKey: "company-a/round-a1-stop-1700000000000.jpg" },
  ]);
  assert.equal(result.counts.proofObjects, 1);
});

test("une entreprise absente n'ouvre aucune autre lecture", async () => {
  const { calls, prisma } = makeRepository();
  assert.equal(await loadService(prisma).exportCompanyData("company-z"), null);
  same(calls.map((call) => call.model), ["company"]);
});

test("l'export lit les collections par pages stables, sans doublon ni perte", async () => {
  const { calls, prisma } = makeRepository();
  const service = loadService(prisma);
  const whole = await service.exportCompanyData("company-a");
  const paged = await service.exportCompanyData("company-a", { pageSize: 1 });
  same(JSON.parse(JSON.stringify(paged)), JSON.parse(JSON.stringify(whole)));
  const orderIds = (paged!.data.orders as Array<{ id: string }>).map((order) => order.id);
  same(orderIds, ["order-a1", "order-a2", "order-a3"]);
  assert.ok(calls.filter((call) => call.model === "order").length >= 4, "lecture page par page");
});

test("l'export en flux écrit le même document v2 que l'export en mémoire", async () => {
  const { prisma } = makeRepository();
  const service = loadService(prisma);
  const memory = await service.exportCompanyData("company-a", { pageSize: 2 });
  let text = "";
  const writer = service.createCompanyExportJsonWriter(async (chunk) => { text += chunk; });
  const summary = await service.visitCompanyExport("company-a", writer.visitor, { pageSize: 2 });
  await writer.finish(summary);
  same(JSON.parse(text), JSON.parse(JSON.stringify(memory)));
});

test("l'écrivain JSON refuse une collection rouverte et l'export refuse une taille de page hors bornes", async () => {
  const { prisma } = makeRepository();
  const service = loadService(prisma);
  const writer = service.createCompanyExportJsonWriter(async () => undefined);
  await writer.visitor.start({ schema: "annona-company-export", version: 2, exportedAt: fixedNow }, { id: "company-a" });
  await writer.visitor.page("users", []);
  await writer.visitor.page("orders", []);
  await assert.rejects(writer.visitor.page("users", []), /EXPORT_COLLECTION_ORDER/);
  for (const pageSize of [0, 1_001, 1.5]) {
    await assert.rejects(service.exportCompanyData("company-a", { pageSize }), /EXPORT_INVALID_PAGE_SIZE/);
  }
});
