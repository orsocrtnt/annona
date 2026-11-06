import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { buildManagedSubscriptionView, buildSubscriptionView, getSubscriptionView } from "../src/domains/billing/subscription-view.service";
import { getNavItemsForRole } from "../src/features/navigation/get-nav-items";

function account(usedOrders = 79) {
  return {
    state: {
      activeContract: {
        quote: { planCode: "PRO", planName: "Pro", billingInterval: "MONTHLY" },
        lines: [
          { code: "plan:PRO", name: "Pro", quantity: 1, unitHtCents: 17900 },
          { code: "auto_dispatch", name: "Dispatch automatique", quantity: 2, unitHtCents: 2900 },
        ],
      },
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      pendingChange: null,
      invoices: [
        { id: "invoice-provider-secret", reason: "subscription_cycle", status: "paid", periodEnd: "2099-11-01T00:00:00.000Z", dueAt: "2026-10-20T00:00:00.000Z", totalCents: 21480, providerCustomerId: "cus_secret" },
        { id: "invoice-provider-secret", reason: "subscription_cycle", status: "paid", periodEnd: "2099-11-01T00:00:00.000Z", dueAt: "2026-10-20T00:00:00.000Z", totalCents: 21480 },
        { id: "invoice-distinct", reason: "subscription_cycle", status: "paid", periodEnd: "2099-11-01T00:00:00.000Z", dueAt: "2026-10-20T00:00:00.000Z", totalCents: 21480 },
      ],
      providerSubscriptionId: "sub_secret",
    },
    subscription: {
      currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      cancelAtPeriodEnd: false,
      premiumDiscoveryEndsAt: null,
      usagePeriods: [{
        startsAt: new Date("2026-10-01T00:00:00.000Z"),
        endsAt: new Date("2026-11-01T00:00:00.000Z"),
        includedOrders: 100,
        orderCount: usedOrders,
        overageCount: Math.max(0, usedOrders - 100),
      }],
    },
    operations: [
      { id: "operation-one", kind: "CANCEL", status: "DONE", createdAt: new Date("2026-10-20T00:00:00.000Z"), completedAt: null, input: { providerSecret: "hidden" } },
      { id: "operation-one", kind: "CANCEL", status: "DONE", createdAt: new Date("2026-10-20T00:00:00.000Z"), completedAt: null },
      { id: "operation-two", kind: "CHANGE", status: "DONE", createdAt: new Date("2026-10-25T00:00:00.000Z"), completedAt: new Date("2026-10-26T00:00:00.000Z"), result: { customer: "cus_secret" } },
      { id: "event:evt_1", kind: "EVENT", status: "DONE", createdAt: new Date("2026-10-26T00:00:00.000Z"), completedAt: new Date("2026-10-26T00:00:00.000Z") },
      { id: "reminder-1", kind: "REMINDER_DUE", status: "PENDING_DELIVERY", createdAt: new Date("2026-10-26T00:00:00.000Z"), completedAt: null },
    ],
  };
}

test("SAAS-03 : projection active filtre les secrets, options, période et historique", () => {
  const view = buildSubscriptionView(account() as never);
  assert.ok(view);
  assert.deepEqual(view.formula, { code: "PRO", name: "Pro" });
  assert.equal(view.billingInterval, "MONTHLY");
  assert.deepEqual(view.usage, { usedOrders: 79, includedOrders: 100, overageOrders: 0 });
  assert.deepEqual(view.options, [{ code: "auto_dispatch", name: "Dispatch automatique", quantity: 2, unitPriceCents: 2900 }]);
  assert.equal(view.history.length, 4);
  assert.deepEqual(view.history.filter((entry) => entry.type === "invoice").map((entry) => entry.occurredAt), ["2026-10-20T00:00:00.000Z", "2026-10-20T00:00:00.000Z"]);
  assert.equal(view.history.filter((entry) => entry.type === "operation").length, 2, "webhooks et relances internes absents");
  assert.ok(view.history.every((entry) => entry.status !== "DONE"));
  assert.ok(view.history.some((entry) => entry.status === "Terminée"));
  assert.deepEqual(view.history.map((entry) => entry.occurredAt), [...view.history.map((entry) => entry.occurredAt)].sort().reverse());
  assert.ok(!JSON.stringify(view).includes("secret"));
  assert.ok(!JSON.stringify(view).includes("provider"));
  assert.ok(!JSON.stringify(view).includes("invoice-provider"));
});

test("SAAS-03 : alertes de consommation 79/80/100/120 et états connexes", () => {
  for (const [used, code] of [[79, undefined], [80, "USAGE_80"], [100, "USAGE_100"], [120, "USAGE_120"]] as const) {
    const view = buildSubscriptionView(account(used) as never)!;
    assert.equal(view.alerts.find((alert) => alert.code.startsWith("USAGE_"))?.code, code);
  }
  const pending = account(100);
  pending.state.status = "PAST_DUE";
  pending.state.cancelAtPeriodEnd = true;
  (pending.state as Record<string, unknown>).pendingChange = { contract: {} };
  const view = buildSubscriptionView(pending as never)!;
  assert.deepEqual(view.alerts.map((alert) => alert.code), ["USAGE_100", "STATUS_PAST_DUE", "CANCEL_AT_PERIOD_END", "PENDING_CHANGE"]);
});

test("SAAS-03 : la résiliation en libre-service n'est proposée qu'une fois, et jamais pour un abonnement géré", () => {
  const active = buildSubscriptionView(account() as never)!;
  assert.equal(active.canCancel, true);
  assert.equal(active.cancelAtPeriodEnd, false);
  const late = account();
  late.state.status = "PAST_DUE";
  assert.equal(buildSubscriptionView(late as never)!.canCancel, true, "un retard de paiement n'empêche pas de résilier");
  const cancelling = account();
  cancelling.state.cancelAtPeriodEnd = true;
  const view = buildSubscriptionView(cancelling as never)!;
  assert.equal(view.cancelAtPeriodEnd, true);
  assert.equal(view.canCancel, false);
  const ended = account();
  ended.state.status = "CANCELLED";
  assert.equal(buildSubscriptionView(ended as never)!.canCancel, false);
  const team = buildManagedSubscriptionView(managed("PILOT") as never, new Date("2026-10-27T12:00:00Z"))!;
  assert.equal(team.canCancel, false);
  assert.equal(team.canChange, false);
  assert.equal(active.canChange, true);
  assert.equal(view.canChange, false, "résiliation programmée : pas de changement");
  assert.equal(buildSubscriptionView(late as never)!.canChange, false, "retard de paiement : régulariser d’abord");
  const pending = account();
  (pending.state as Record<string, unknown>).pendingChange = { contract: {} };
  assert.equal(buildSubscriptionView(pending as never)!.canChange, false);
});

test("SAAS-03 : compte ou contrat absent produit un état vide sans abonnement inventé", async () => {
  assert.equal(buildSubscriptionView({ ...account(), state: { activeContract: null }, operations: [] } as never), null);
  let where: unknown = null;
  let fallback: unknown = null;
  const db = {
    saasBillingAccount: {
      findFirst: async (input: { where: unknown }) => {
        where = input.where;
        return null;
      },
    },
    saasSubscription: {
      findUnique: async (input: { where: unknown }) => {
        fallback = input.where;
        return null;
      },
    },
  };
  assert.equal(await getSubscriptionView("company-a", db as never), null);
  assert.deepEqual(where, { subscription: { companyId: "company-a" } });
  assert.deepEqual(fallback, { companyId: "company-a" });
});

const at = new Date("2026-10-27T10:00:00.000Z");
function managed(kind: "COMMERCIAL" | "PILOT" | "LEGACY", overrides: Record<string, unknown> = {}) {
  return {
    kind,
    status: "ACTIVE",
    billingInterval: kind === "COMMERCIAL" ? "ANNUAL" : null,
    currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
    currentPeriodEnd: kind === "LEGACY" ? null : new Date("2026-11-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    premiumDiscoveryEndsAt: null,
    providerCustomerId: "cus_secret",
    planAssignments: kind === "COMMERCIAL" ? [{ plan: { code: "STARTER", name: "Starter" } }] : [],
    items: kind === "COMMERCIAL"
      ? [
          { code: "auto_dispatch", quantity: 1, unitPriceCents: 29000, option: { name: "Dispatch automatique" } },
          { code: "driver_seat", quantity: 2, unitPriceCents: 9000, option: null },
        ]
      : [],
    usagePeriods: [{
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-11-01T00:00:00.000Z"),
      includedOrders: kind === "COMMERCIAL" ? 1000 : 2_147_483_647,
      orderCount: 850,
      overageCount: 0,
    }],
    ...overrides,
  };
}

test("SAAS-03 : abonnement géré par Annona, formule et options lues sur l'abonnement, sans historique ni fournisseur", () => {
  const view = buildManagedSubscriptionView(managed("COMMERCIAL") as never, at)!;
  assert.equal(view.management, "ANNONA_TEAM");
  assert.deepEqual(view.formula, { code: "STARTER", name: "Starter" });
  assert.equal(view.billingInterval, "ANNUAL");
  assert.deepEqual(view.options, [
    { code: "auto_dispatch", name: "Dispatch automatique", quantity: 1, unitPriceCents: 29000 },
    { code: "driver_seat", name: "driver_seat", quantity: 2, unitPriceCents: 9000 },
  ]);
  assert.deepEqual(view.alerts.map((alert) => alert.code), ["USAGE_80"]);
  assert.deepEqual(view.history, []);
  assert.ok(!JSON.stringify(view).includes("secret"));
  assert.equal(buildSubscriptionView(account() as never)!.management, "SELF_SERVICE");
});

test("SAAS-03 : pilote et accès historique affichés sans formule inventée ni alerte de plafond", () => {
  const pilot = buildManagedSubscriptionView(managed("PILOT") as never, at)!;
  assert.deepEqual(pilot.formula, { code: "PILOT", name: "Pilote accompagné" });
  assert.equal(pilot.billingInterval, null);
  assert.deepEqual(pilot.usage, { usedOrders: 850, includedOrders: 2_147_483_647, overageOrders: 0 });
  assert.deepEqual(pilot.alerts, []);
  assert.equal(pilot.premiumDiscovery, null);
  const legacy = buildManagedSubscriptionView(managed("LEGACY", { usagePeriods: [] }) as never, at)!;
  assert.deepEqual(legacy.formula, { code: "LEGACY", name: "Accès historique" });
  assert.equal(legacy.period.endsAt, null);
  assert.equal(legacy.usage, null);
  assert.equal(buildManagedSubscriptionView(managed("COMMERCIAL", { planAssignments: [] }) as never, at), null, "commercial sans formule active");
  const cancelling = buildManagedSubscriptionView(managed("COMMERCIAL", { status: "CANCEL_AT_PERIOD_END", cancelAtPeriodEnd: true }) as never, at)!;
  assert.deepEqual(cancelling.alerts.map((alert) => alert.code), ["USAGE_80", "CANCEL_AT_PERIOD_END"]);
});

test("SAAS-03 : le repli ne lit que l'abonnement de l'entreprise et seulement sans compte de facturation", async () => {
  const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
  const db = (billing: unknown) => ({
    saasBillingAccount: { findFirst: async (args: Record<string, unknown>) => { calls.push({ model: "billing", args }); return billing; } },
    saasSubscription: { findUnique: async (args: Record<string, unknown>) => { calls.push({ model: "subscription", args }); return managed("PILOT"); } },
  });
  assert.equal((await getSubscriptionView("company-a", db(account()) as never))!.management, "SELF_SERVICE");
  assert.deepEqual(calls.map((call) => call.model), ["billing"], "compte présent : pas de repli");
  calls.length = 0;
  assert.equal((await getSubscriptionView("company-a", db(null) as never, at))!.formula.code, "PILOT");
  const select = calls[1]!.args.select as Record<string, { where?: unknown }>;
  const active = { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] };
  assert.deepEqual(calls[1]!.args.where, { companyId: "company-a" });
  assert.deepEqual(select.planAssignments!.where, active);
  assert.deepEqual(select.items!.where, active);
  assert.ok(!("providerCustomerId" in select) && !("providerSubscriptionId" in select) && !("snapshot" in select));
});

test("SAAS-03 : seule la navigation COMPANY_ADMIN expose Mon abonnement", () => {
  for (const role of ["SUPER_ADMIN", "DISPATCHER", "MINI_ADMIN"] as const) {
    assert.ok(!getNavItemsForRole(role).some((item) => item.href === "/settings/subscription"));
  }
  assert.ok(getNavItemsForRole("COMPANY_ADMIN").some((item) => item.href === "/settings/subscription" && item.title === "Mon abonnement"));
});

function loadRoute(role: string, companyId: string | null, result: unknown, failure = false) {
  const module = { exports: {} as { GET?: () => Promise<Response> } };
  const source = ts.transpileModule(
    readFileSync(resolve("src/app/api/billing/subscription/route.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  runInNewContext(source, {
    Error, Promise, exports: module.exports, module,
    require: (id: string) => {
      const dependencies: Record<string, unknown> = {
        "next/server": { NextResponse },
        "@/lib/config-messages": require("../src/lib/config-messages"),
        "@/lib/api/auth-guard": {
          requireStaffRole: async () => ({ context: { user: { companyId, role: { systemRole: role } } } }),
          requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
          getCompanyId: (context: { user: { companyId: string | null } }) => context.user.companyId,
        },
        "@/domains/billing/subscription-view.service": {
          getSubscriptionView: async (company: string) => {
            assert.equal(company, companyId);
            if (failure) throw new Error("local failure");
            return result;
          },
        },
      };
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports.GET!;
}

test("SAAS-03 : API COMPANY_ADMIN isolée, no-store, vide et erreur lisible", async () => {
  const view = buildSubscriptionView(account() as never);
  const accepted = await loadRoute("COMPANY_ADMIN", "company-a", view)();
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await accepted.json(), { data: view });
  for (const role of ["SUPER_ADMIN", "DISPATCHER", "MINI_ADMIN", "CLIENT"] as const) {
    assert.equal((await loadRoute(role, "company-a", view)()).status, 403);
  }
  assert.equal((await loadRoute("COMPANY_ADMIN", null, view)()).status, 403);
  assert.deepEqual(await (await loadRoute("COMPANY_ADMIN", "company-a", null)()).json(), { data: null });
  const failed = await loadRoute("COMPANY_ADMIN", "company-a", view, true)();
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "Chargement de l’abonnement impossible : réessayez dans un instant ; si cela persiste, contactez le support." });
});
