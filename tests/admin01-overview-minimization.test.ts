import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = (file: string) => ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

test("ADMIN-1 vue plateforme : les entreprises récentes n'emportent plus le slug", async () => {
  const limits = { exports: {} as { PLATFORM_COMPANIES_TAKE?: number } };
  runInNewContext(source("src/lib/query/list-limits.ts"), { exports: limits.exports, module: limits });
  const seen: { select?: Record<string, unknown>; orderBy?: unknown; take?: number; invoice?: unknown } = {};
  const module = { exports: {} as { getPlatformOverview?: (now: Date) => Promise<{ companies: Array<Record<string, unknown>>; stats: { paidDeliveryInvoiceRevenue: number } }> } };
  const dependencies: Record<string, unknown> = {
    "@/services/prisma/client": {
      prisma: {
        company: {
          count: async () => 4,
          findMany: async (args: { select: Record<string, unknown>; orderBy: unknown; take: number }) => {
            seen.select = args.select;
            seen.orderBy = args.orderBy;
            seen.take = args.take;
            return [{ id: "company-1", name: "Nord", status: "ACTIVE", _count: { users: 2, deliveries: 3 } }];
          },
        },
        user: { count: async () => 9 },
        delivery: { count: async () => 6 },
        invoice: { aggregate: async (args: unknown) => { seen.invoice = args; return { _sum: { amount: 12 } }; } },
      },
    },
    "@/lib/query/list-limits": limits.exports,
  };
  runInNewContext(source("src/domains/admin/platform.service.ts"), {
    exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  const overview = await module.exports.getPlatformOverview!(new Date("2026-10-25T12:00:00.000Z"));
  assert.equal(Object.keys(seen.select ?? {}).sort().join(","), "_count,id,name,status");
  assert.equal(JSON.stringify(seen.select?._count), JSON.stringify({ select: { users: true, deliveries: true } }));
  assert.equal(JSON.stringify(seen.orderBy), JSON.stringify({ createdAt: "desc" }));
  assert.equal(seen.take, limits.exports.PLATFORM_COMPANIES_TAKE);
  assert.equal(JSON.stringify(seen.invoice).includes("PAID"), true);
  assert.equal(overview.stats.paidDeliveryInvoiceRevenue, 12);
  assert.equal(Object.hasOwn(overview.stats, "totalRevenue"), false);
  const page = readFileSync("src/app/(back-office)/admin/page.tsx", "utf8");
  const service = readFileSync("src/domains/admin/platform.service.ts", "utf8");
  assert.equal(page.includes("Factures de livraison payées"), true);
  assert.equal(page.includes("totalRevenue") || service.includes("totalRevenue"), false);
  for (const word of ["MRR", "ARR", "revenu d’abonnement", "chiffre d’affaires"]) {
    assert.equal(page.includes(word), false, word);
  }
  assert.equal(Object.hasOwn(overview, "saasHealth"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(overview.companies[0])), {
    id: "company-1", name: "Nord", status: "ACTIVE", users: 2, deliveries: 3,
  });
  assert.equal(Object.hasOwn(overview.companies[0] ?? {}, "slug"), false);
});
