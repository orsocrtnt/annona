import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

type Res = { status: number };

function loadRoute(readLogo: () => Promise<Buffer | null>) {
  const received: Array<{ companyLogoPng: unknown; paidAt: unknown }> = [];
  class FakeResponse {
    status = 200;
    constructor(_body: unknown, init?: { status?: number }) { this.status = init?.status ?? 200; }
    static json(_body: unknown, init?: { status?: number }) { return { status: init?.status ?? 200 }; }
  }
  const invoice = {
    reference: "FAC-1", status: "PAID", createdAt: new Date(), dueDate: null, paidAt: new Date("2026-10-25T09:00:00Z"),
    amount: 10, lineItems: [{ label: "Ligne", amount: 10, quantity: 1 }], notes: null, companyId: "company_a",
    order: { reference: "CMD-1" }, company: { name: "Entreprise" },
  };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/api/auth-guard": { requireClientRole: async () => ({ context: { user: { id: "u", companyId: "company_a", firstName: "A", lastName: "B", email: "a@b.test" } } }) },
    "@/domains/invoice/invoice.service": { getClientInvoiceById: async () => invoice },
    "@/domains/company/billing-settings.service": { getCompanyBillingSettings: async () => ({ invoice: { footerNote: null } }) },
    "@/domains/company/company-logo.service": { readCompanyLogo: readLogo },
    "@/lib/pdf/invoice-pdf": { generateInvoicePdf: async (data: { companyLogoPng: unknown; paidAt: unknown }) => { received.push(data); return new Uint8Array([1]); } },
  };
  const loaded = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve("src/app/api/portal/invoices/[id]/pdf/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, { Array, Buffer, Number, Promise, exports: loaded.exports, module: loaded, require: (id: string) => deps[id] });
  const route = loaded.exports as { GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Res> };
  return { call: () => route.GET(new Request("http://local.test"), { params: Promise.resolve({ id: "inv" }) }), received };
}

test("le relevé PDF reçoit le logo de l'entreprise et la date de paiement", async () => {
  const logo = Buffer.from("png");
  const { call, received } = loadRoute(async () => logo);
  assert.equal((await call()).status, 200);
  assert.equal(received[0]!.companyLogoPng, logo);
  assert.ok(received[0]!.paidAt instanceof Date);
});

test("une lecture du logo en échec ne bloque pas le relevé", async () => {
  const { call, received } = loadRoute(async () => { throw new Error("STORAGE_DOWN"); });
  assert.equal((await call()).status, 200);
  assert.equal(received[0]!.companyLogoPng, null);
});
