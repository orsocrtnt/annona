import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

type Handler = (request: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;

function load(file: string, role: string, calls: string[], service: Record<string, unknown> = {}, emailConfigured = true) {
  const loaded = { exports: {} as { GET?: Handler; POST?: Handler } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        // Un dispatcher n'a pas les droits de facturation : la garde de permission le refuse.
        if (role === "DISPATCHER") return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
        return { context: { user: { id: `user-${role}`, role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN");
        return roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company_a"; },
    },
    "@/domains/invoice/company-invoices.service": {
      COMPANY_INVOICE_FILTERS: ["ALL", "PENDING", "OVERDUE", "PAID"],
      listCompanyInvoices: async (companyId: string, options: { status: string }) => {
        calls.push(`list:${companyId}:${options.status}`);
        return { invoices: [], counts: { PAID: 0, PENDING: 0, OVERDUE: 0 }, limit: 100 };
      },
      ...service,
    },
    "@/domains/invoice/invoice-reminder.service": {
      remindInvoice: async (input: Record<string, unknown>) => {
        calls.push(`remind:${input.companyId}:${input.invoiceId}:${input.userId}:${input.emailConfigured}`);
        return { reminder: { id: "rem_1", result: "QUEUED" }, duplicate: false };
      },
      ...service,
    },
    "@/domains/client-portal/notify.service": { getEmailDeliveryConfigured: () => emailConfigured },
  };
  runInNewContext(source, {
    Error, Response, URL, console, exports: loaded.exports, module: loaded,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return loaded.exports;
}

const LIST = "src/app/api/invoices/route.ts";
const REMIND = "src/app/api/invoices/[id]/reminders/route.ts";
const params = (id = "inv_1") => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://local/api/invoices/inv_1/reminders", { method: "POST" });

test("DEMO-3 routes : liste et relance refusées aux rôles sans droit de facturation, avant tout accès", async () => {
  for (const role of ["DISPATCHER", "SUPER_ADMIN", "CLIENT", "DRIVER"]) {
    const calls: string[] = [];
    const list = await load(LIST, role, calls).GET!(new Request("http://local/api/invoices"));
    assert.equal(list.status, 403, role);
    const remind = await load(REMIND, role, calls).POST!(post(), params());
    assert.equal(remind.status, 403, role);
    assert.ok(calls.includes("staff:invoices:read") && calls.includes("staff:invoices:update"), role);
    assert.equal(calls.some((call) => call.startsWith("list:") || call.startsWith("remind:") || call === "company"), false, role);
  }
});

test("DEMO-3 routes : un administrateur ou mini-admin facturation liste les paiements de son entreprise", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN"]) {
    const calls: string[] = [];
    const response = await load(LIST, role, calls).GET!(new Request("http://local/api/invoices?status=OVERDUE"));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.counts, { PAID: 0, PENDING: 0, OVERDUE: 0 });
    assert.ok(calls.includes("list:company_a:OVERDUE"));
  }
  const calls: string[] = [];
  await load(LIST, "COMPANY_ADMIN", calls).GET!(new Request("http://local/api/invoices"));
  assert.ok(calls.includes("list:company_a:ALL"), "toutes par défaut");
});

test("DEMO-3 routes : filtre de statut inconnu refusé", async () => {
  const calls: string[] = [];
  const response = await load(LIST, "COMPANY_ADMIN", calls).GET!(new Request("http://local/api/invoices?status=DROP"));
  assert.equal(response.status, 400);
  assert.equal(calls.some((call) => call.startsWith("list:")), false);
});

test("DEMO-3 routes : la relance transmet entreprise, facture, auteur et état de l'e-mail", async () => {
  for (const emailConfigured of [true, false]) {
    const calls: string[] = [];
    const response = await load(REMIND, "MINI_ADMIN", calls, {}, emailConfigured).POST!(post(), params());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.reminder.id, "rem_1");
    assert.ok(calls.includes(`remind:company_a:inv_1:user-MINI_ADMIN:${emailConfigured}`));
  }
});

test("DEMO-3 routes : facture d'une autre entreprise introuvable, facture réglée en conflit", async () => {
  const missing = await load(REMIND, "COMPANY_ADMIN", [], { remindInvoice: async () => null }).POST!(post(), params());
  assert.equal(missing.status, 404);
  const settled = await load(REMIND, "COMPANY_ADMIN", [], {
    remindInvoice: async () => { throw new Error("INVOICE_NOT_REMINDABLE"); },
  }).POST!(post(), params());
  assert.equal(settled.status, 409);
  assert.equal((await settled.json()).error, "Cette facture est réglée, annulée ou en brouillon : aucune relance possible.");
});
