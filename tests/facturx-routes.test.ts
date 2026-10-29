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

import { createRequire } from "node:module";
const nodeRequire = createRequire(import.meta.url);

/** Charge un module du dépôt et, récursivement, ses dépendances « @/ » réelles ; seules les surcharges sont simulées. */
function loadReal(file: string, overrides: Record<string, unknown>, cache: Record<string, Record<string, unknown>> = {}): Record<string, (...args: unknown[]) => Promise<Res>> {
  const loaded = { exports: {} as Record<string, unknown> };
  const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, {
    Array, Buffer, Date, Error, JSON, Math, Number, Object, Promise, String, URL, setTimeout, console,
    exports: loaded.exports, module: loaded,
    require: (id: string) => {
      if (id in overrides) return overrides[id];
      if (id.startsWith("@/")) {
        const path = `src/${id.slice(2)}.ts`;
        return (cache[path] ??= loadReal(path, overrides, cache));
      }
      return nodeRequire(id);
    },
  });
  return loaded.exports as Record<string, (...args: unknown[]) => Promise<Res>>;
}

/** Seule frontière simulée : Prisma (une entreprise en mémoire), l'authentification et la réponse HTTP. */
function einvoicing(role: Role, stored: { einvoicing?: Record<string, unknown>; billing?: Record<string, unknown>; issuedInvoices?: number; failWrite?: "conflict" | "taken" } = {}) {
  const company = {
    id: "company_a", legalName: null, siren: "732829320", siret: null, billingAddress: "12 rue de l'Exemple", billingPostalCode: "75011", billingCity: "Paris", country: "FR",
    settings: { ...(stored.einvoicing ? { einvoicing: stored.einvoicing } : {}), ...(stored.billing ? { billing: { invoice: stored.billing } } : {}) } as Record<string, unknown>,
    updatedAt: new Date(1000),
  };
  const writes: Array<Record<string, unknown>> = [];
  const prisma = {
    company: {
      findUnique: async () => ({ ...company }),
      updateMany: async ({ where, data }: { where: { updatedAt: Date }; data: Record<string, unknown> }) => {
        if (stored.failWrite === "conflict" || +where.updatedAt !== +company.updatedAt) return { count: 0 };
        if (stored.failWrite === "taken") throw new (nodeRequire("@prisma/client").Prisma.PrismaClientKnownRequestError)("unique", { code: "P2002", clientVersion: "x" });
        Object.assign(company, data);
        writes.push(data);
        return { count: 1 };
      },
    },
    invoice: { count: async () => stored.issuedInvoices ?? 0 },
  };
  const overrides = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": staffAuth(role),
    "@/lib/api/route-handler": { withApiHandler: (fn: () => Promise<Res>) => fn(), readJsonBody: async (request: Request) => request.json().catch(() => null) },
    "@/services/prisma/client": { prisma },
    "@/domains/company/company-logo.service": { readCompanyLogo: async () => null },
    "@/lib/pdf/invoice-pdf": { generateInvoicePdf: async () => new Uint8Array() },
  };
  const cache = {};
  const route = loadReal("src/app/api/company/einvoicing/route.ts", overrides, cache);
  const billingRoute = loadReal("src/app/api/company/billing-settings/route.ts", overrides, cache);
  const patch = (body: unknown) => route.PATCH!(new Request("http://local.test/api/company/einvoicing", { method: "PATCH", body: JSON.stringify(body) }));
  const patchBilling = (invoice: Record<string, unknown>) => billingRoute.PATCH!(new Request("http://local.test/api/company/billing-settings", { method: "PATCH", body: JSON.stringify({ courier: { basePrice: 8, pricePerKm: 1.2, minimumPrice: 10, nightSurchargePercent: 0, weekendSurchargePercent: 0, freeKmIncluded: 0, showClientEstimate: false }, invoice: { defaultDueDays: 30, referencePrefix: "FAC", footerNote: "", autoInvoiceOnDelivery: false, ...invoice } }) }));
  const storedEinvoicing = () => (company.settings.einvoicing ?? {}) as Record<string, unknown>;
  return { route, patch, patchBilling, writes, storedEinvoicing, company };
}

const MENTIONS = { latePenaltyText: "Trois fois le taux légal.", earlyPaymentDiscountText: "Pas d'escompte." };
const validBody = {
  identity: { legalName: "Coursiers Fictifs SAS", siren: "732829320", siret: "73282932000074", billingAddress: "12 rue de l'Exemple", billingPostalCode: "75011", billingCity: "Paris", country: "FR" },
  einvoicing: { vatNumber: "FR44732829320", latePenaltyText: "Trois fois le taux d'intérêt légal.", earlyPaymentDiscountText: "Pas d'escompte." },
};
const incompleteBody = { identity: { siren: "732829320", country: "FR" }, einvoicing: {} };

test("mentions légales : incomplètes et facture électronique activée = refus par champ, rien n'est enregistré", async () => {
  const activated = einvoicing("COMPANY_ADMIN");
  const refused = await activated.patch({ ...incompleteBody, einvoicing: { enabled: true } });
  assert.equal(refused.status, 400);
  const fields = Object.keys((refused.body as { fieldErrors: Record<string, string> }).fieldErrors).sort();
  assert.deepEqual(fields, ["billingAddress", "billingCity", "billingPostalCode", "earlyPaymentDiscountText", "latePenaltyText", "vatNumber"]);
  assert.equal(activated.writes.length, 0);

  const stored = einvoicing("COMPANY_ADMIN", { einvoicing: { enabled: true } });
  assert.equal((await stored.patch(incompleteBody)).status, 400, "enabled absent du corps : la valeur enregistrée (activée) s'applique");
  assert.equal(stored.writes.length, 0);
});

test("mentions légales : entreprise qui ne fait que des PDF, même avec des factures émises = enregistrement accepté, manques signalés", async () => {
  const idle = einvoicing("COMPANY_ADMIN", { issuedInvoices: 12 });
  const saved = await idle.patch(incompleteBody);
  assert.equal(saved.status, 200);
  const data = (saved.body as { data: { enforced: boolean; missing: Array<{ field: string }> } }).data;
  assert.equal(data.enforced, false);
  assert.ok(data.missing.some((issue) => issue.field === "latePenaltyText"));
  assert.equal(idle.writes.length, 1);
  const read = await idle.route.GET!();
  assert.equal((read.body as { data: { enforced: boolean } }).data.enforced, false);
});

test("mentions légales : enabled omis conserve la valeur enregistrée (activée ou non), enabled explicite la remplace", async () => {
  const on = einvoicing("COMPANY_ADMIN", { einvoicing: { enabled: true } });
  assert.equal((await on.patch(validBody)).status, 200);
  assert.equal(on.storedEinvoicing().enabled, true);
  assert.equal((await on.patch({ ...validBody, einvoicing: { ...validBody.einvoicing, enabled: false } })).status, 200);
  assert.equal(on.storedEinvoicing().enabled, false);
  assert.equal((await on.patch(validBody)).status, 200);
  assert.equal(on.storedEinvoicing().enabled, false, "désactivée puis omise : reste désactivée");
});

test("mentions légales : le taux de TVA des réglages décide de la mention exigée quand la facture électronique est activée", async () => {
  const withVat = einvoicing("COMPANY_ADMIN", { einvoicing: { enabled: true }, billing: { vatRate: 20 } });
  const noVatNumber = { ...validBody, einvoicing: { latePenaltyText: "Trois fois le taux légal.", earlyPaymentDiscountText: "Pas d'escompte." } };
  const refused = await withVat.patch(noVatNumber);
  assert.equal(refused.status, 400);
  assert.deepEqual([...Object.keys((refused.body as { fieldErrors: Record<string, string> }).fieldErrors)], ["vatNumber"]);
  assert.equal((await withVat.patch({ ...noVatNumber, einvoicing: { ...noVatNumber.einvoicing, taxRegistrationId: "12345678901" } })).status, 400, "l'identifiant fiscal seul ne suffit pas");

  const exempt = einvoicing("COMPANY_ADMIN", { einvoicing: { enabled: true }, billing: { vatRate: 0 } });
  const refusedExempt = await exempt.patch(noVatNumber);
  assert.equal(refusedExempt.status, 400);
  assert.deepEqual([...Object.keys((refusedExempt.body as { fieldErrors: Record<string, string> }).fieldErrors)], ["vatExemptionReason"]);
  assert.equal((await exempt.patch({ ...noVatNumber, einvoicing: { ...noVatNumber.einvoicing, vatExemptionReason: "TVA non applicable, art. 293 B du CGI" } })).status, 200);

  const idle = einvoicing("COMPANY_ADMIN", { billing: { vatRate: 20 } });
  const saved = await idle.patch(noVatNumber);
  assert.equal(saved.status, 200, "facture électronique non activée : jamais bloquée");
  assert.deepEqual([...(saved.body as { data: { advisories: Array<{ field: string }> } }).data.advisories.map((a) => a.field)], ["vatNumber"]);
});

test("réglages de facturation : passer la TVA de 0 à 20 % avec la facture électronique activée et sans n° de TVA est refusé, clairement", async () => {
  const sans = einvoicing("COMPANY_ADMIN", { einvoicing: { ...MENTIONS, enabled: true, vatExemptionReason: "TVA non applicable, art. 293 B du CGI" }, billing: { vatRate: 0 } });
  const refused = await sans.patchBilling({ vatRate: 20 });
  assert.equal(refused.status, 400);
  assert.match((refused.body as { error: string }).error, /N° de TVA/);
  assert.equal(sans.writes.length, 0);
  assert.equal((await sans.patchBilling({ vatRate: 0 })).status, 200, "taux inchangé : jamais bloqué");

  const inverse = einvoicing("COMPANY_ADMIN", { einvoicing: { ...MENTIONS, enabled: true, vatNumber: "FR44732829320" }, billing: { vatRate: 20 } });
  const refusedInverse = await inverse.patchBilling({ vatRate: 0 });
  assert.equal(refusedInverse.status, 400);
  assert.match((refusedInverse.body as { error: string }).error, /exonération/);

  const tenToTwenty = einvoicing("COMPANY_ADMIN", { einvoicing: { ...MENTIONS, enabled: true }, billing: { vatRate: 20 } });
  const refusedTen = await tenToTwenty.patchBilling({ vatRate: 10 });
  assert.equal(refusedTen.status, 400, "taux 20 % -> 10 % sans n° de TVA : configuration non prête");
  assert.ok((refusedTen.body as { fieldErrors: Record<string, string> }).fieldErrors.vatNumber);
  assert.equal((await tenToTwenty.patchBilling({ vatRate: 20 })).status, 200, "taux inchangé : accepté malgré des données héritées incomplètes");
  assert.equal(tenToTwenty.writes.length, 1);
  const invalidRate = await tenToTwenty.patchBilling({ vatRate: "abc" });
  assert.equal(invalidRate.status, 400);
  assert.match((invalidRate.body as { error: string }).error, /^Taux de TVA : saisissez un nombre/);
  assert.doesNotMatch((invalidRate.body as { error: string }).error, /Invalid|expected/);

  const idle = einvoicing("COMPANY_ADMIN", { billing: { vatRate: 0 } });
  assert.equal((await idle.patchBilling({ vatRate: 20 })).status, 200, "facture électronique non activée : accepté");
  const ok = einvoicing("COMPANY_ADMIN", { einvoicing: { ...MENTIONS, enabled: true, vatNumber: "FR44732829320" }, billing: { vatRate: 0 } });
  assert.equal((await ok.patchBilling({ vatRate: 20 })).status, 200);
});

test("mentions légales : lecture d'une entreprise activée aux données héritées incomplètes sans erreur", async () => {
  const legacy = einvoicing("COMPANY_ADMIN", { einvoicing: { enabled: true }, billing: { vatRate: 20 } });
  const res = await legacy.route.GET!();
  assert.equal(res.status, 200);
  assert.ok((res.body as { data: { missing: Array<{ field: string }> } }).data.missing.some((m) => m.field === "vatNumber"));
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
  assert.equal(admin.writes.length, 1);
  for (const role of ["MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as Role[]) {
    const other = einvoicing(role);
    assert.equal((await other.patch(validBody)).status, 403, role);
    assert.equal((await other.route.GET!()).status, 403, role);
    assert.equal(other.writes.length, 0);
  }
});

test("mentions légales : données invalides (400)", async () => {
  const admin = einvoicing("COMPANY_ADMIN");
  const invalid = await admin.patch({ ...validBody, einvoicing: { vatNumber: "FR00732829320" } });
  assert.equal(invalid.status, 400);
  assert.equal(admin.writes.length, 0);
  assert.equal((await einvoicing("COMPANY_ADMIN", { failWrite: "taken" }).patch(validBody)).status, 409);
  assert.equal((await einvoicing("COMPANY_ADMIN", { failWrite: "conflict" }).patch(validBody)).status, 409);
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
    "@/lib/config-messages": require("../src/lib/config-messages"),
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
