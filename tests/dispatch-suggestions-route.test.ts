import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "../src/lib/api/route-handler";

type Route = { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> };

/** Route réelle ; frontières simulées : session, droits SaaS, service de dispatch. */
function load(input: {
  role?: string;
  saas?: (mutation: boolean) => Promise<void>;
  suggestions?: () => Promise<unknown>;
  assign?: () => Promise<unknown>;
  calls?: string[];
}) {
  const calls = input.calls ?? [];
  const module = { exports: {} as Route };
  const source = ts.transpileModule(readFileSync("src/app/api/dispatch/suggestions/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    zod: { z },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push("staff");
        assert.equal(permission, "deliveries:dispatch");
        return { context: { user: { role: { systemRole: input.role ?? "DISPATCHER" } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal(roles.join(","), "COMPANY_ADMIN,MINI_ADMIN,DISPATCHER");
        return roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => "company-1",
    },
    "@/domains/saas/saas.service": {
      assertSaasFeature: async (companyId: string, feature: string) => {
        calls.push(`saas:${companyId}:${feature}`);
        return input.saas?.(false);
      },
      assertSaasMutationFeature: async (companyId: string, feature: string) => {
        calls.push(`saas-mutation:${companyId}:${feature}`);
        return input.saas?.(true);
      },
    },
    "@/domains/delivery/auto-dispatch.service": {
      getDispatchSuggestions: async (companyId: string, deliveryId: string) => {
        calls.push(`suggest:${companyId}:${deliveryId}`);
        return input.suggestions ? input.suggestions() : { deliveryId, suggestions: [] };
      },
      assignFromSuggestion: async (companyId: string, deliveryId: string, driverId: string) => {
        calls.push(`assign:${companyId}:${deliveryId}:${driverId}`);
        return input.assign ? input.assign() : { id: deliveryId, driverId, status: "ASSIGNED", latitude: 48.1, order: { customerEmail: "x@e2e.invalid" } };
      },
    },
  };
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => { assert.ok(id in dependencies, `Dépendance inattendue ${id}`); return dependencies[id]; },
  });
  return module.exports;
}

const get = (query = "?deliveryId=d1") => new Request(`http://local/api/dispatch/suggestions${query}`);
const post = (body: unknown) => new Request("http://local/api/dispatch/suggestions", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});

test("suggestions : client, livreur et super-admin refusés avant tout calcul", async () => {
  for (const role of ["CLIENT", "DRIVER", "SUPER_ADMIN"]) {
    const calls: string[] = [];
    const route = load({ role, calls });
    assert.equal((await route.GET(get())).status, 403, role);
    assert.equal((await route.POST(post({ deliveryId: "d1", driverId: "x" }))).status, 403, role);
    assert.ok(calls.every((c) => c === "staff" || c === "role"), `${role} : ${calls.join(",")}`);
  }
});

test("suggestions : sans l'option « Dispatch automatique » (ou sans abonnement) → 403 explicite", async () => {
  for (const code of ["SAAS_FEATURE_NOT_AVAILABLE", "SAAS_SUBSCRIPTION_REQUIRED"]) {
    const calls: string[] = [];
    const route = load({ calls, saas: async () => { throw new Error(code); } });
    const response = await route.GET(get());
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /Dispatch automatique/);
    assert.equal(calls.some((c) => c.startsWith("suggest")), false, "aucun calcul sans l'option");
    assert.equal((await route.POST(post({ deliveryId: "d1", driverId: "x" }))).status, 403);
    assert.equal(calls.some((c) => c.startsWith("assign")), false);
  }
  const readOnly = load({ saas: async (mutation) => { if (mutation) throw new Error("SAAS_ACCOUNT_READ_ONLY"); } });
  assert.equal((await readOnly.GET(get())).status, 200, "lecture permise en lecture seule");
  assert.equal((await readOnly.POST(post({ deliveryId: "d1", driverId: "x" }))).status, 403, "affectation refusée en lecture seule");
});

test("suggestions : entreprise de la session, paramètre requis, 404 si absente", async () => {
  const calls: string[] = [];
  const route = load({ calls });
  assert.equal((await route.GET(get(""))).status, 400);
  assert.equal((await route.GET(get())).status, 200);
  assert.ok(calls.includes("saas:company-1:auto_dispatch"));
  assert.ok(calls.includes("suggest:company-1:d1"));
  const missing = load({ suggestions: async () => null });
  assert.equal((await missing.GET(get())).status, 404);
});

test("affectation en un clic : réponse minimale, sans coordonnée ni donnée client", async () => {
  const calls: string[] = [];
  const route = load({ calls });
  const response = await route.POST(post({ deliveryId: "d1", driverId: "drv" }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { id: "d1", driverId: "drv", status: "ASSIGNED" });
  assert.ok(calls.includes("saas-mutation:company-1:auto_dispatch"));
  assert.ok(calls.includes("assign:company-1:d1:drv"));
  assert.equal((await route.POST(post("{pas du json"))).status, 400);
  assert.equal((await route.POST(post({ deliveryId: "d1" }))).status, 400);
});

test("affectation en un clic : conflits et livreur devenu incompatible → 409 lisible, jamais 500", async () => {
  const cases: Array<[string, number, RegExp]> = [
    ["DELIVERY_NOT_AVAILABLE", 409, /déjà été affectée/],
    ["DELIVERY_ASSIGNMENT_CONFLICT", 409, /autre dispatcher/],
    ["DELIVERY_MISSION_STARTED", 409, /démarré/],
    ["DELIVERY_NOT_ASSIGNABLE", 409, /ne peut plus/],
    ["DRIVER_OVER_CAPACITY:Charge max atteinte", 409, /plus disponible : Charge max atteinte/],
    ["DRIVER_INELIGIBLE:Hors zone couverte", 409, /plus disponible : Hors zone couverte/],
    ["DRIVER_NOT_FOUND", 404, /introuvable/],
  ];
  for (const [code, status, message] of cases) {
    const route = load({ assign: async () => { throw new Error(code); } });
    const response = await route.POST(post({ deliveryId: "d1", driverId: "drv" }));
    assert.equal(response.status, status, code);
    assert.match((await response.json()).error, message, code);
  }
  const missing = load({ assign: async () => null });
  assert.equal((await missing.POST(post({ deliveryId: "d1", driverId: "drv" }))).status, 404);
});
