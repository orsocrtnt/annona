import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { getPlatformCompany, platformCompanyDetailSelect, toPlatformCompanyDetail } from "../src/domains/admin/companies.service";

const now = new Date("2026-10-25T12:00:00.000Z");

test("ADMIN-1 détail entreprise : identité, abonnement et chiffre d'affaires, sans réglages ni fournisseur", async () => {
  let seen: { where: { id: string }; select: ReturnType<typeof platformCompanyDetailSelect> } | undefined;
  const row = await getPlatformCompany("company-1", {
    company: {
      findUnique: async (args) => {
        seen = args;
        return {
          id: "company-1",
          name: "Acme",
          legalName: "Acme SAS",
          slug: "acme",
          status: "ACTIVE" as const,
          isDemo: false,
          email: "contact@acme.fr",
          phone: "0102030405",
          address: "1 rue",
          city: "Lyon",
          country: "FR",
          siren: "123456789",
          siret: "12345678900011",
          billingAddress: "1 rue",
          billingPostalCode: "69001",
          billingCity: "Lyon",
          createdAt: now,
          _count: { users: 2, deliveries: 3 },
          users: [{ firstName: "Ada", lastName: "Lovelace", email: "ada@acme.fr", phone: null }],
          saasSubscription: {
            status: "PAST_DUE" as const,
            kind: "COMMERCIAL" as const,
            billingInterval: "MONTHLY" as const,
            currentPeriodStart: now,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            endedAt: null,
            premiumDiscoveryEndsAt: null,
            planAssignments: [{ plan: { code: "PRO" as const, name: "Pro", monthlyPriceCents: 17900, annualPriceCents: 179000 } }],
            items: [
              { code: "AUTO_DISPATCH", kind: "OPTION" as const, quantity: 1, unitPriceCents: 0, option: { name: "Affectation automatique" } },
              { code: "EXTRA_ADMIN", kind: "ADMIN_SEAT" as const, quantity: 1, unitPriceCents: 1200, option: { name: "Admin supplémentaire" } },
            ],
            usagePeriods: [{ includedOrders: 100, orderCount: 10, overageCount: 0 }],
          },
        };
      },
    },
    invoice: {
      groupBy: async () => [
        { status: "PAID" as const, _sum: { amount: "100.50" } },
        { status: "OVERDUE" as const, _sum: { amount: "20" } },
      ],
    },
  }, now);
  assert.deepEqual(seen?.select, platformCompanyDetailSelect(now));
  assert.equal(seen?.where.id, "company-1");
  assert.equal(row?.legalName, "Acme SAS");
  assert.equal(row?.admin?.name, "Ada Lovelace");
  assert.equal(row?.revenue.paidCents, 10050);
  assert.equal(row?.revenue.overdueCents, 2000);
  assert.equal(row?.revenue.pendingCents, 0);
  assert.equal(row?.subscription?.followUp, "REMIND");
  assert.equal(row?.subscription?.amountCents, 19100);
  assert.deepEqual(row?.subscription?.options, [{ code: "AUTO_DISPATCH", name: "Affectation automatique", quantity: 1, unitPriceCents: 0 }]);
  assert.equal(row?.subscription?.seats.ADMIN_SEAT, 1);
  const select = JSON.stringify(platformCompanyDetailSelect(now));
  for (const forbidden of ["settings", "snapshot", "providerCustomerId", "providerSubscriptionId", "logoUrl"]) {
    assert.equal(select.includes(forbidden), false, forbidden);
  }
  assert.equal(await getPlatformCompany("missing", {
    company: { findUnique: async () => null },
    invoice: { groupBy: async () => { throw new Error("invoice"); } },
  }), null);
  assert.equal(toPlatformCompanyDetail.length, 2);
});

test("ADMIN-1 détail entreprise : journal avant paramètres, 404 et lecture seule", async () => {
  const source = readFileSync("src/app/api/admin/companies/[id]/route.ts", "utf8");
  assert.deepEqual([...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map((match) => match[1]), ["GET"]);
  assert.ok(source.indexOf("gatePlatformRead") < source.indexOf("context.params"));
  assert.equal(source.includes("request.url"), false);

  const module = { exports: {} as { GET?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const calls: string[] = [];
  let company: Record<string, unknown> | null = null;
  runInNewContext(compiled, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async () => ({ context: { user: { id: "actor-1", role: { systemRole: "SUPER_ADMIN" } } } }),
        requireRole: () => null,
      };
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (...args: unknown[]) => {
          calls.push("audit");
          assert.equal(JSON.stringify(args).includes("company-1"), false);
          assert.equal(args[2], "COMPANY_DETAIL");
          return null;
        },
      };
      if (id === "@/domains/admin/companies.service") return {
        getPlatformCompany: async (id: string) => {
          calls.push("service");
          assert.equal(id, "company-1");
          return company;
        },
      };
      throw new Error(id);
    },
  });
  const params = Promise.resolve({ id: "company-1" });
  const originalThen = params.then.bind(params);
  params.then = ((onFulfilled, onRejected) => {
    calls.push("params");
    return originalThen(onFulfilled, onRejected);
  }) as typeof params.then;

  const missing = await module.exports.GET!(new Request("http://local/api/admin/companies/company-1"), { params });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "no-store");
  assert.equal((await missing.json()).error, "Entreprise introuvable");
  assert.deepEqual(calls, ["audit", "params", "service"]);

  company = {
    id: "company-1", name: "Acme", legalName: null, slug: "acme", status: "ACTIVE", isDemo: false,
    email: null, phone: null, address: null, city: null, country: "FR", siren: null, siret: null,
    billingAddress: null, billingPostalCode: null, billingCity: null, createdAt: now.toISOString(),
    userCount: 2, deliveryCount: 3, admin: null, revenue: { paidCents: 0, pendingCents: 0, overdueCents: 0 }, subscription: null,
  };
  calls.length = 0;
  const found = await module.exports.GET!(new Request("http://local/api/admin/companies/company-1"), { params });
  assert.equal(found.status, 200);
  assert.equal(found.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(Object.keys((await found.json()).data).sort(), [
    "address", "admin", "billingAddress", "billingCity", "billingPostalCode", "city", "country", "createdAt",
    "deliveryCount", "email", "id", "isDemo", "legalName", "name", "phone", "revenue", "siren", "siret", "slug",
    "status", "subscription", "userCount",
  ]);
});

test("ADMIN-1 détail entreprise : l'écran et le lien restent minimaux", () => {
  const page = readFileSync("src/app/(back-office)/companies/[id]/page.tsx", "utf8");
  const list = readFileSync("src/app/(back-office)/companies/page.tsx", "utf8");
  const api = readFileSync("src/features/admin/api.ts", "utf8");
  const hooks = readFileSync("src/features/admin/hooks.ts", "utf8");
  assert.equal(page.includes("useAdminCompany(id)"), true);
  assert.equal(page.includes("<PageSkeleton />"), true);
  assert.equal(page.includes("Entreprise indisponible"), true);
  assert.equal(page.includes("Entreprise introuvable"), true);
  const fields = [...page.matchAll(/company\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fields)].sort(), [
    "address", "admin", "billingAddress", "billingCity", "billingPostalCode", "city", "country", "createdAt",
    "deliveryCount", "email", "isDemo", "legalName", "name", "phone", "revenue", "siren", "siret", "slug",
    "status", "subscription", "userCount",
  ]);
  for (const absent of ["company.id", "settings", "Modifier", "Supprimer", "href="]) {
    assert.equal(page.includes(absent), false, absent);
  }
  for (const present of ["CA encaissé", "HT enregistré", "À relancer", "Aucune option"]) {
    assert.equal(page.includes(present), true, present);
  }
  assert.equal(list.includes("href={`/companies/${row.id}`}"), true);
  assert.equal(list.includes("{row.name}"), true);
  assert.equal(api.includes('fetch(`/api/admin/companies/${id}`, { cache: "no-store" })'), true);
  const hook = hooks.slice(hooks.indexOf("export function useAdminCompany"), hooks.indexOf("export function useAdminOverview"));
  assert.equal(hook.includes("refetchInterval"), false);
});
