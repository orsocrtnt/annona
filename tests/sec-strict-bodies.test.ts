import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";
import { contactMessageSchema } from "../src/domains/growth/contact.service";
import { salesCodeCreateSchema } from "../src/domains/sales/sales-code.service";
import { courierEstimateRequestSchema } from "../src/lib/validations/courier-estimate";

// SEC-4 : les corps JSON sont validés par Zod .strict() ; tout champ inconnu,
// type inattendu ou JSON mal formé reçoit une réponse 400 claire, sans appel métier.
type Handler = (request: Request, context?: unknown) => Promise<Response>;
type Handlers = { GET: Handler; POST: Handler; PATCH: Handler };
function load(file: string, dependencies: Record<string, unknown>): Handlers {
  const module = { exports: {} as Handlers };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const deps: Record<string, unknown> = { "next/server": { NextResponse }, zod, "@/lib/api/route-handler": { withApiHandler }, ...dependencies };
  runInNewContext(source, { exports: module.exports, module, console, Error, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id];
  } });
  return module.exports;
}
const json = (body: unknown, method = "POST") =>
  new Request("http://local", { method, headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const clientAuth = { requireClientRole: async () => ({ context: { user: { id: "client-1", companyId: "company-1" } } }) };

test("estimation portail : champs connus acceptés (null toléré), champ inconnu ou type invalide refusé", async () => {
  const calls: unknown[] = [];
  const { POST } = load("src/app/api/portal/order-estimate/route.ts", {
    "@/lib/api/auth-guard": clientAuth,
    "@/lib/validations/courier-estimate": { courierEstimateRequestSchema },
    "@/domains/company/courier-estimate.service": { estimateCourierPrice: async (companyId: string, input: unknown) => { calls.push([companyId, input]); return { enabled: false, amount: null, distanceKm: null }; } },
  });
  const valid = { pickupAddress: "1 rue A", pickupCity: "Lyon", pickupPostalCode: "69001", shippingAddress: "2 rue B", shippingCity: null, requestedDeliveryDate: "2026-11-02" };
  assert.equal((await POST(json(valid))).status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify((calls[0] as unknown[])[1])), {
    pickup: { address: "1 rue A", city: "Lyon", postalCode: "69001" },
    shipping: { address: "2 rue B", city: null, postalCode: null },
    requestedDeliveryDate: "2026-11-02",
  });
  for (const body of [{ ...valid, companyId: "company-2" }, { pickupAddress: 42 }, "{", ["array"]]) {
    const response = await POST(json(body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await response.json()).error, /invalide/i);
  }
  assert.equal(calls.length, 1);
});

test("notifications portail : ids facultatifs, champ inconnu ou id non texte refusé", async () => {
  const marked: unknown[] = [];
  const { PATCH } = load("src/app/api/portal/notifications/route.ts", {
    "@/lib/api/auth-guard": clientAuth,
    "@/domains/client-portal/notify.service": {
      listClientNotifications: async () => [],
      markClientNotificationsRead: async (userId: string, ids?: string[]) => { marked.push([userId, ids]); },
    },
  });
  assert.equal((await PATCH(json({}, "PATCH"))).status, 200);
  assert.equal((await PATCH(json({ ids: ["n1", "n2"] }, "PATCH"))).status, 200);
  assert.equal((marked[0] as unknown[])[1], undefined);
  assert.deepEqual([...(marked[1] as [string, string[]])[1]], ["n1", "n2"]);
  for (const body of [{ ids: ["n1"], userId: "other" }, { ids: [1] }, { ids: "n1" }, "not-json"]) {
    assert.equal((await PATCH(json(body, "PATCH"))).status, 400, JSON.stringify(body));
  }
  assert.equal(marked.length, 2);
});

test("désactivation de code commercial : seule l'action disable est admise, sans champ supplémentaire", async () => {
  const disabled: string[] = [];
  const { PATCH } = load("src/app/api/admin/sales-codes/[id]/route.ts", {
    "@/lib/api/auth-guard": { requireStaffRole: async () => ({ context: { user: { id: "owner" } } }), requireRole: () => null },
    "@/lib/api/platform-access": { gatePlatformRead: async () => null, gatePlatformWrite: async () => null },
    "@/domains/sales/sales-code.service": { getSalesCodeHistory: async () => null, disableSalesCode: async (id: string) => { disabled.push(id); return { status: "disabled" }; } },
  });
  const context = { params: Promise.resolve({ id: "code-1" }) };
  for (const body of [{ action: "disable", level: "AUTONOMOUS" }, { action: "enable" }, {}, "{"]) {
    assert.equal((await PATCH(json(body, "PATCH"), context)).status, 400, JSON.stringify(body));
  }
  assert.equal(disabled.length, 0);
  assert.equal((await PATCH(json({ action: "disable" }, "PATCH"), context)).status, 200);
  assert.deepEqual(disabled, ["code-1"]);
});

test("contact et création de code commercial : schémas stricts côté service", () => {
  const contact = { name: "Test Local", email: "local@example.test", message: "Bonjour, ceci est un test." };
  assert.equal(contactMessageSchema.safeParse(contact).success, true);
  assert.equal(contactMessageSchema.safeParse({ ...contact, sourceHash: "forge" }).success, false);
  const code = { sellerName: "Vendeur Test", sellerEmail: "seller@example.test", level: "REFERRER" };
  assert.equal(salesCodeCreateSchema.safeParse(code).success, true);
  assert.equal(salesCodeCreateSchema.safeParse({ ...code, createdById: "owner" }).success, false);
});
