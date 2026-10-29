import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

type Res = { status: number; body: unknown; headers: Record<string, string> };
type Role = "COMPANY_ADMIN" | "MINI_ADMIN" | "DISPATCHER" | "DRIVER" | "CLIENT";

class FakeResponse {
  status: number;
  headers: Record<string, string>;
  constructor(public body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }
  static json(body: unknown, init?: { status?: number }) {
    return new FakeResponse(body, init);
  }
}

function load(file: string, deps: Record<string, unknown>) {
  const loaded = { exports: {} as Record<string, unknown> };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Array, Buffer, Date, Error, JSON, Number, Object, Promise, String, URL,
    exports: loaded.exports, module: loaded,
    require: (id: string) => {
      if (!(id in deps)) throw new Error(`dépendance non simulée : ${id}`);
      return deps[id];
    },
  });
  return loaded.exports as Record<string, (...args: unknown[]) => Promise<Res>>;
}

// Deux entreprises, deux clients : chaque facture appartient à une entreprise et à un client.
const INVOICES: Record<string, { companyId: string; customerId: string; reference?: string }> = {
  inv_a: { companyId: "company_a", customerId: "client_a" },
  inv_q: { companyId: "company_a", customerId: "client_a", reference: 'FAC"; evil=1' },
  inv_a2: { companyId: "company_a", customerId: "client_a2" },
  inv_b: { companyId: "company_b", customerId: "client_b" },
};

function fakeInvoiceService(calls: unknown[], facturxOk = true) {
  return {
    loadFacturXInvoice: async (scope: { invoiceId: string; companyId: string; customerId?: string }) => {
      calls.push(scope);
      const row = INVOICES[scope.invoiceId];
      if (!row || row.companyId !== scope.companyId) return null;
      if (scope.customerId !== undefined && row.customerId !== scope.customerId) return null;
      return { companyId: row.companyId, reference: row.reference ?? `FAC-${scope.invoiceId}`, source: { ok: true }, pdf: {} };
    },
    renderClassicInvoicePdf: async () => new Uint8Array([1, 2, 3]),
    facturxOk,
  };
}

function documentDeps(facturxOk: boolean) {
  return {
    safeFilename: (reference: string) => reference.replace(/[^A-Za-z0-9._-]+/g, "_") || "facture",
    buildFacturXPdf: async () => (facturxOk ? { ok: true, pdf: new Uint8Array([9]), xml: "<x/>", warnings: [] } : { ok: false, errors: [{ rule: "TL-FR-SIREN", message: "SIREN de l'entreprise manquant." }], warnings: [] }),
    facturXHttpResult: (result: { ok: boolean }, reference: string, audience: string) =>
      result.ok
        ? { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reference}-facturx.pdf"` }, body: new Uint8Array([9]) }
        : { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: `refus ${audience}` },
  };
}

function staffAuth(role: Role, companyId = "company_a") {
  const staff = role !== "DRIVER" && role !== "CLIENT";
  return {
    requireStaffRole: async () => (staff ? { context: { user: { id: "staff", companyId, role: { systemRole: role } } } } : { error: FakeResponse.json({ error: "Accès refusé" }, { status: 403 }) }),
    requireRole: (context: { user: { role: { systemRole: Role } } }, roles: Role[]) =>
      roles.includes(context.user.role.systemRole) ? null : FakeResponse.json({ error: "Accès refusé" }, { status: 403 }),
    getCompanyId: (context: { user: { companyId: string | null } }) => context.user.companyId,
  };
}

function backOffice(role: Role, opts: { companyId?: string; facturxOk?: boolean; renderFails?: boolean } = {}) {
  const calls: unknown[] = [];
  const handled = { count: 0 };
  const service = fakeInvoiceService(calls);
  if (opts.renderFails) service.renderClassicInvoicePdf = async () => { throw new Error("PDF_RENDER_DOWN"); };
  const route = load("src/app/api/invoices/[id]/pdf/route.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": staffAuth(role, opts.companyId),
    // Comme withApiHandler : toute exception devient une réponse JSON 500 formatée.
    "@/lib/api/route-handler": {
      withApiHandler: async (fn: () => Promise<Res>) => {
        handled.count += 1;
        try { return await fn(); } catch { return FakeResponse.json({ error: "Erreur serveur" }, { status: 500 }); }
      },
    },
    "@/domains/invoice/facturx/facturx.service": service,
    "@/domains/invoice/facturx/facturx-document": documentDeps(opts.facturxOk ?? true),
  });
  const call = (id: string, query = "") => route.GET!(new Request(`http://local.test/api/invoices/${id}/pdf${query}`), { params: Promise.resolve({ id }) });
  return { call, calls, handled };
}

test("back-office : la route passe par withApiHandler, une erreur de rendu donne un 500 formaté", async () => {
  const { call, handled } = backOffice("COMPANY_ADMIN", { renderFails: true });
  const res = await call("inv_a");
  assert.equal(handled.count, 1);
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body)), { error: "Erreur serveur" });
});

test("back-office : PDF classique par défaut, Factur-X sur demande, refus lisible en 422", async () => {
  const { call, calls } = backOffice("COMPANY_ADMIN");
  const classic = await call("inv_a");
  assert.equal(classic.status, 200);
  assert.equal(classic.headers["Content-Type"], "application/pdf");
  assert.match(classic.headers["Content-Disposition"]!, /^inline; filename="FAC-inv_a.pdf"/);
  const fx = await call("inv_a", "?format=facturx");
  assert.equal(fx.status, 200);
  assert.match(fx.headers["Content-Disposition"]!, /attachment; filename="FAC-inv_a-facturx.pdf"/);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { invoiceId: "inv_a", companyId: "company_a" }, "aucun filtre client côté back-office, entreprise imposée");

  const refused = await backOffice("MINI_ADMIN", { facturxOk: false }).call("inv_a", "?format=facturx");
  assert.equal(refused.status, 422);
  assert.equal(refused.body, "refus staff");
  assert.equal((await backOffice("COMPANY_ADMIN").call("inv_a", "?format=xml")).status, 400);
});

test("back-office : une facture d'une autre entreprise est introuvable (404), classique comme Factur-X", async () => {
  const { call, calls } = backOffice("COMPANY_ADMIN");
  assert.equal((await call("inv_b")).status, 404);
  assert.equal((await call("inv_b", "?format=facturx")).status, 404);
  assert.ok(calls.every((scope) => (scope as { companyId: string }).companyId === "company_a"));
  assert.equal((await backOffice("COMPANY_ADMIN", { companyId: "company_b" }).call("inv_b", "?format=facturx")).status, 200);
});

test("back-office : rôles hors administration refusés (403)", async () => {
  for (const role of ["DISPATCHER", "DRIVER", "CLIENT"] as Role[]) {
    assert.equal((await backOffice(role).call("inv_a", "?format=facturx")).status, 403, role);
  }
});

function portal(user: { id: string; companyId: string | null }, facturxOk = true) {
  const calls: unknown[] = [];
  const route = load("src/app/api/portal/invoices/[id]/pdf/route.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": { requireClientRole: async () => ({ context: { user: { ...user, firstName: "A", lastName: "B", email: "a@b.test" } } }) },
    "@/domains/invoice/invoice.service": { getClientInvoiceById: async () => null },
    "@/domains/company/billing-settings.service": { getCompanyBillingSettings: async () => ({ invoice: { footerNote: null } }) },
    "@/domains/company/company-logo.service": { readCompanyLogo: async () => null },
    "@/lib/pdf/invoice-pdf": { generateInvoicePdf: async () => new Uint8Array([1]) },
    "@/domains/invoice/facturx/facturx.service": fakeInvoiceService(calls),
    "@/domains/invoice/facturx/facturx-document": documentDeps(facturxOk),
  });
  const call = (id: string, query = "") => route.GET!(new Request(`http://local.test/api/portal/invoices/${id}/pdf${query}`), { params: Promise.resolve({ id }) });
  return { call, calls };
}

test("portail : PDF classique chargé comme le Factur-X (client propriétaire), nom de fichier assaini", async () => {
  const { call, calls } = portal({ id: "client_a", companyId: "company_a" });
  const classic = await call("inv_a");
  assert.equal(classic.status, 200);
  assert.equal(classic.headers["Content-Type"], "application/pdf");
  assert.equal(classic.headers["Content-Disposition"], 'inline; filename="FAC-inv_a.pdf"');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { invoiceId: "inv_a", companyId: "company_a", customerId: "client_a" });
  assert.equal((await call("inv_q")).headers["Content-Disposition"], 'inline; filename="FAC_evil_1.pdf"');
  assert.equal((await call("inv_a2")).status, 404, "facture d'un autre client");
  assert.equal((await call("inv_b")).status, 404, "facture d'une autre entreprise");
  assert.equal((await backOffice("COMPANY_ADMIN").call("inv_q")).headers["Content-Disposition"], 'inline; filename="FAC_evil_1.pdf"');
});

test("portail : Factur-X limité au client propriétaire de la facture et à son entreprise", async () => {
  const { call, calls } = portal({ id: "client_a", companyId: "company_a" });
  const ok = await call("inv_a", "?format=facturx");
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { invoiceId: "inv_a", companyId: "company_a", customerId: "client_a" });
  assert.equal((await call("inv_a2", "?format=facturx")).status, 404, "facture d'un autre client de la même entreprise");
  assert.equal((await call("inv_b", "?format=facturx")).status, 404, "facture d'une autre entreprise");
  assert.equal((await portal({ id: "client_a", companyId: null }).call("inv_a", "?format=facturx")).status, 403);
  const refused = await portal({ id: "client_a", companyId: "company_a" }, false).call("inv_a", "?format=facturx");
  assert.equal(refused.status, 422);
  assert.equal(refused.body, "refus client", "le client reçoit le message générique");
});

function einvoicing(role: Role, update: (companyId: string, input: unknown) => Promise<unknown> = async (_c, input) => input, uses = false) {
  const calls: Array<[string, unknown]> = [];
  const route = load("src/app/api/company/einvoicing/route.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": staffAuth(role),
    "@/lib/api/route-handler": { withApiHandler: (fn: () => Promise<Res>) => fn() },
    "@/domains/invoice/facturx/facturx.service": {
      getCompanyEinvoicing: async (companyId: string) => ({ identity: { companyId }, einvoicing: {} }),
      companyUsesEinvoicing: async () => uses,
      updateCompanyEinvoicing: async (companyId: string, input: unknown) => {
        calls.push([companyId, input]);
        return update(companyId, input);
      },
    },
    "@/domains/invoice/facturx/facturx-readiness": require("../src/domains/invoice/facturx/facturx-readiness"),
    "@/lib/validations/einvoicing": require("../src/lib/validations/einvoicing"),
  });
  const patch = (body: unknown) => route.PATCH!(new Request("http://local.test/api/company/einvoicing", { method: "PATCH", body: JSON.stringify(body) }));
  return { route, patch, calls };
}

const validBody = {
  identity: { legalName: "Coursiers Fictifs SAS", siren: "732829320", siret: "73282932000074", billingAddress: "12 rue de l'Exemple", billingPostalCode: "75011", billingCity: "Paris", country: "FR" },
  einvoicing: { vatNumber: "FR44732829320", latePenaltyText: "Trois fois le taux d'intérêt légal.", earlyPaymentDiscountText: "Pas d'escompte." },
};
const incompleteBody = { identity: { siren: "732829320", country: "FR" }, einvoicing: {} };

test("mentions légales : incomplètes et facture électronique activée ou utilisée = refus par champ côté serveur", async () => {
  const activated = einvoicing("COMPANY_ADMIN");
  const refused = await activated.patch({ ...incompleteBody, einvoicing: { enabled: true } });
  assert.equal(refused.status, 400);
  const fields = Object.keys((refused.body as { fieldErrors: Record<string, string> }).fieldErrors).sort();
  assert.deepEqual(fields, ["billingAddress", "billingCity", "billingPostalCode", "earlyPaymentDiscountText", "latePenaltyText", "vatExemptionReason"]);
  assert.equal(activated.calls.length, 0, "rien n'est enregistré");

  const used = einvoicing("COMPANY_ADMIN", undefined, true);
  assert.equal((await used.patch(incompleteBody)).status, 400);
  assert.equal(used.calls.length, 0);
});

test("mentions légales : entreprise qui n'utilise pas la facture électronique = enregistrement accepté, manques signalés", async () => {
  const idle = einvoicing("COMPANY_ADMIN");
  const saved = await idle.patch(incompleteBody);
  assert.equal(saved.status, 200);
  const data = (saved.body as { data: { enforced: boolean; missing: Array<{ field: string }> } }).data;
  assert.equal(data.enforced, false);
  assert.ok(data.missing.some((issue) => issue.field === "latePenaltyText"));
  assert.equal(idle.calls.length, 1);
});

test("mentions légales : format invalide = message par champ même sans blocage", async () => {
  const idle = einvoicing("COMPANY_ADMIN");
  const bad = await idle.patch({ identity: { siren: "12", country: "FR" }, einvoicing: { iban: "FR7630006000011234567890188" } });
  assert.equal(bad.status, 400);
  const errors = (bad.body as { fieldErrors: Record<string, string> }).fieldErrors;
  assert.ok(errors.siren && errors.iban);
});

test("mentions légales : lecture d'une entreprise aux mentions incomplètes sans erreur", async () => {
  const res = await einvoicing("COMPANY_ADMIN").route.GET!();
  assert.equal(res.status, 200);
  const data = (res.body as { data: { missing: unknown[] } }).data;
  assert.ok(data.missing.length > 0);
});

test("mentions légales : administrateur de l'entreprise uniquement, écriture limitée à son entreprise", async () => {
  const admin = einvoicing("COMPANY_ADMIN");
  assert.equal((await admin.route.GET!()).status, 200);
  const saved = await admin.patch(validBody);
  assert.equal(saved.status, 200);
  assert.equal(admin.calls[0]![0], "company_a");
  for (const role of ["MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as Role[]) {
    const other = einvoicing(role);
    assert.equal((await other.patch(validBody)).status, 403, role);
    assert.equal((await other.route.GET!()).status, 403, role);
    assert.equal(other.calls.length, 0);
  }
});

test("mentions légales : données invalides (400) et SIREN déjà utilisé (409)", async () => {
  const admin = einvoicing("COMPANY_ADMIN");
  const invalid = await admin.patch({ ...validBody, einvoicing: { vatNumber: "FR00732829320" } });
  assert.equal(invalid.status, 400);
  assert.equal(admin.calls.length, 0);
  const taken = einvoicing("COMPANY_ADMIN", async () => { throw new Error("COMPANY_IDENTITY_TAKEN"); });
  assert.equal((await taken.patch(validBody)).status, 409);
  const conflict = einvoicing("COMPANY_ADMIN", async () => { throw new Error("SETTINGS_CONFLICT"); });
  assert.equal((await conflict.patch(validBody)).status, 409);
});

function identity(role: Role, companyId = "company_a") {
  const clients: Record<string, string> = { client_a: "company_a", client_b: "company_b" };
  const route = load("src/app/api/company/clients/[id]/invoice-identity/route.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": staffAuth(role, companyId),
    "@/lib/api/route-handler": { withApiHandler: (fn: () => Promise<Res>) => fn() },
    "@/domains/invoice/facturx/facturx.service": {
      getClientInvoiceIdentity: async (company: string, clientId: string) => (clients[clientId] === company ? null : undefined),
      updateClientInvoiceIdentity: async (company: string, clientId: string, value: unknown) => (clients[clientId] === company ? value : null),
    },
    "@/lib/validations/einvoicing": require("../src/lib/validations/einvoicing"),
  });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  return {
    get: (id: string) => route.GET!(new Request("http://local.test"), ctx(id)),
    put: (id: string, body: unknown) => route.PUT!(new Request("http://local.test", { method: "PUT", body: JSON.stringify(body) }), ctx(id)),
  };
}

test("identité de facturation client : administrateur seulement, client d'une autre entreprise introuvable", async () => {
  const body = { companyName: "Client Démo SARL", siren: "552100554", address: "3 avenue Fictive", postalCode: "69002", city: "Lyon" };
  const admin = identity("COMPANY_ADMIN");
  assert.equal((await admin.get("client_a")).status, 200);
  assert.equal((await admin.put("client_a", body)).status, 200);
  assert.equal((await admin.get("client_b")).status, 404);
  assert.equal((await admin.put("client_b", body)).status, 404);
  assert.equal((await admin.put("client_a", { ...body, postalCode: "" })).status, 400);
  assert.equal((await identity("MINI_ADMIN").put("client_a", body)).status, 403);
  assert.equal((await identity("DISPATCHER").get("client_a")).status, 403);
});
