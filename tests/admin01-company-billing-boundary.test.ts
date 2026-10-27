import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { NextResponse } from "next/server";

const zod = createRequire(import.meta.url)("zod");
const deniedRoles = ["SUPER_ADMIN", "MINI_ADMIN", "DISPATCHER"];
const preview = {
  action: "preview",
  selection: { planCode: "STARTER", billingInterval: "MONTHLY", selections: [{ code: "SEAT", quantity: 1 }] },
};
const change = {
  ...preview,
  action: "change",
  key: "change-key",
  prorationDate: 1_700_000_000,
  confirmedTotalCents: 7900,
  confirmed: true,
};
const cancel = { action: "cancel", key: "cancel-key", confirmed: true };

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as { GET?: () => Promise<Response>; POST?: (request: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, Date, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function tracked(calls: string[], body: unknown) {
  const request = new Request("http://local/api/billing", { method: "POST", body: JSON.stringify(body) });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  return request;
}

function auth(calls: string[], role: string, companyId: string | null) {
  return {
    requireStaffRole: async (permission: string) => {
      calls.push("staff");
      assert.equal(permission, "settings:read");
      return { context: { user: { id: "admin-1", companyId, role: { systemRole: role } } } };
    },
    requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
      calls.push("role");
      assert.equal([...roles].join(","), "COMPANY_ADMIN");
      return context.user.role.systemRole === "COMPANY_ADMIN"
        ? null
        : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    },
    getCompanyId: () => { calls.push("company"); return companyId; },
  };
}

type Blockers = Array<{ resource: string; current: number; limit: number; excess: number }>;

function billingDependencies(calls: string[], role: string, companyId: string | null, account: { id: string; state: unknown } | null, blockers: Blockers = []) {
  return {
    zod,
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": auth(calls, role, companyId),
    "@/services/prisma/client": {
      prisma: {
        saasBillingAccount: { findFirst: async () => { calls.push("account"); return account; } },
        saasBillingOperation: { findMany: async () => { calls.push("operations"); return [{ id: "op-1", kind: "CHANGE", status: "DONE", createdAt: "2026-10-25", completedAt: null }]; } },
      },
    },
    "@/domains/billing/billing.service": {
      sandboxBilling: () => {
        calls.push("provider");
        return {
          preview: async () => { calls.push("preview"); return { amountDueCents: 7900 }; },
          command: async (_accountId: string, _key: string, command: { actorId: string; kind: string }) => {
            calls.push(`command:${command.kind}:${command.actorId}`);
            return { status: "ACCEPTED" };
          },
          reconcile: async () => { calls.push("reconcile"); },
        };
      },
    },
    "@/domains/signup/signup.service": {
      getActiveSignupCatalog: async () => { calls.push("catalog"); return { code: "C9-2026-10-24", plans: [] }; },
    },
    "@/domains/billing/billing-core": {
      makeBillingContract: () => { calls.push("contract"); return { hash: "contract-target", quote: { totalCents: 7900 } }; },
    },
    "@/domains/billing/plan-change.service": {
      assessBillingContractChange: async (assessedCompanyId: string) => {
        calls.push(`assess:${assessedCompanyId}`);
        return { blockers, lostFeatures: [], droppedItems: [], orderOverage: null };
      },
    },
  };
}

const activeAccount = { id: "account-1", state: { activeContract: { hash: "contract-current", quote: { planCode: "PRO" } } } };

test("ADMIN-1 facturation : les autres rôles sont refusés avant l'entreprise, le corps et le fournisseur", async () => {
  for (const role of deniedRoles) {
    for (const method of ["GET", "POST"] as const) {
      const calls: string[] = [];
      const billing = load("src/app/api/billing/route.ts", billingDependencies(calls, role, "company-1", { id: "account-1", state: "ACTIVE" }));
      const response = method === "GET" ? await billing.GET!() : await billing.POST!(tracked(calls, change));
      assert.equal(response.status, 403, `${role} ${method}`);
      assert.deepEqual(calls, ["staff", "role"]);
    }
    const calls: string[] = [];
    const subscription = load("src/app/api/billing/subscription/route.ts", {
      "next/server": { NextResponse },
      "@/lib/api/auth-guard": auth(calls, role, "company-1"),
      "@/domains/billing/subscription-view.service": {
        getSubscriptionView: async () => { calls.push("view"); return { plan: "STARTER" }; },
      },
    });
    assert.equal((await subscription.GET!()).status, 403, role);
    assert.deepEqual(calls, ["staff", "role"]);
  }
});

test("ADMIN-1 facturation : l'administrateur d'entreprise atteint les comportements simulés", async () => {
  const listedCalls: string[] = [];
  const listed = await load("src/app/api/billing/route.ts", billingDependencies(listedCalls, "COMPANY_ADMIN", "company-1", { id: "account-1", state: "ACTIVE" })).GET!();
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get("cache-control"), "no-store");
  assert.equal((await listed.json()).state, "ACTIVE");
  assert.deepEqual(listedCalls, ["staff", "role", "company", "account", "operations", "catalog"]);

  const missingCalls: string[] = [];
  const missing = await load("src/app/api/billing/route.ts", billingDependencies(missingCalls, "COMPANY_ADMIN", "company-1", null)).GET!();
  assert.equal(missing.status, 404);
  assert.deepEqual(missingCalls, ["staff", "role", "company", "account"]);

  for (const [body, expected] of [
    [preview, ["staff", "role", "company", "account", "body", "provider", "catalog", "contract", "assess:company-1", "preview"]],
    [change, ["staff", "role", "company", "account", "body", "provider", "catalog", "contract", "assess:company-1", "command:CHANGE:admin-1", "reconcile"]],
    [cancel, ["staff", "role", "company", "account", "body", "provider", "command:CANCEL:admin-1", "reconcile"]],
  ] as const) {
    const calls: string[] = [];
    const response = await load("src/app/api/billing/route.ts", billingDependencies(calls, "COMPANY_ADMIN", "company-1", activeAccount)).POST!(tracked(calls, body));
    assert.equal(response.status, 200);
    assert.deepEqual(calls, expected);
  }

  // Décision C10 : comptes en excès pour la cible = refus immédiat, aucun appel au fournisseur.
  const excess = [{ resource: "drivers", current: 8, limit: 5, excess: 3 }];
  const refusedCalls: string[] = [];
  const refused = await load("src/app/api/billing/route.ts", billingDependencies(refusedCalls, "COMPANY_ADMIN", "company-1", activeAccount, excess)).POST!(tracked(refusedCalls, change));
  assert.equal(refused.status, 409);
  const refusedBody = await refused.json() as { code: string; blockers: unknown };
  assert.equal(refusedBody.code, "PLAN_CHANGE_SEATS_EXCEEDED");
  assert.deepEqual(refusedBody.blockers, excess);
  assert.deepEqual(refusedCalls, ["staff", "role", "company", "account", "body", "provider", "catalog", "contract", "assess:company-1"]);

  const previewCalls: string[] = [];
  const previewed = await load("src/app/api/billing/route.ts", billingDependencies(previewCalls, "COMPANY_ADMIN", "company-1", activeAccount, excess)).POST!(tracked(previewCalls, preview));
  assert.equal(previewed.status, 200, "l'aperçu reste consultable et montre les dépassements");
  assert.deepEqual((await previewed.json() as { assessment: { blockers: unknown } }).assessment.blockers, excess);

  const sameCalls: string[] = [];
  const sameAccount = { id: "account-1", state: { activeContract: { hash: "contract-target", quote: { planCode: "STARTER" } } } };
  const same = await load("src/app/api/billing/route.ts", billingDependencies(sameCalls, "COMPANY_ADMIN", "company-1", sameAccount)).POST!(tracked(sameCalls, change));
  assert.equal(same.status, 409);
  assert.equal((await same.json() as { code: string }).code, "PLAN_CHANGE_NOOP");
  assert.equal(sameCalls.some((call) => call.startsWith("assess") || call.startsWith("command")), false, "la formule actuelle est refusée avant tout verrou");

  const inactiveCalls: string[] = [];
  const inactive = await load("src/app/api/billing/route.ts", billingDependencies(inactiveCalls, "COMPANY_ADMIN", "company-1", { id: "account-1", state: { activeContract: null } })).POST!(tracked(inactiveCalls, change));
  assert.equal(inactive.status, 409);
  assert.equal(inactiveCalls.some((call) => call.startsWith("assess") || call.startsWith("command")), false);

  const viewCalls: string[] = [];
  const view = load("src/app/api/billing/subscription/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": auth(viewCalls, "COMPANY_ADMIN", "company-1"),
    "@/domains/billing/subscription-view.service": {
      getSubscriptionView: async (companyId: string) => {
        viewCalls.push("view");
        assert.equal(companyId, "company-1");
        return { plan: "STARTER" };
      },
    },
  });
  const subscription = await view.GET!();
  assert.equal(subscription.status, 200);
  assert.equal(subscription.headers.get("cache-control"), "no-store");
  assert.equal((await subscription.json()).data.plan, "STARTER");
  assert.deepEqual(viewCalls, ["staff", "role", "company", "view"]);

  const absentCalls: string[] = [];
  const absent = load("src/app/api/billing/subscription/route.ts", {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": auth(absentCalls, "COMPANY_ADMIN", null),
    "@/domains/billing/subscription-view.service": {
      getSubscriptionView: async () => { absentCalls.push("view"); return {}; },
    },
  });
  assert.equal((await absent.GET!()).status, 403);
  assert.deepEqual(absentCalls, ["staff", "role", "company"]);
});
