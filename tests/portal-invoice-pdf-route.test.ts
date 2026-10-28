import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Le relevé du portail passe par renderClassicInvoicePdf (chargement commun avec le Factur-X) :
// on vérifie ici que le logo et la date de paiement lui parviennent, et qu'un logo illisible ne bloque rien.
function loadRenderer(readLogo: () => Promise<Buffer | null>) {
  const received: Array<{ companyLogoPng: unknown; paidAt: unknown; footerNote: unknown; legal: unknown }> = [];
  const deps: Record<string, unknown> = {
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class {} } },
    "@/domains/invoice/facturx/facturx-scope": {},
    "@/domains/company/billing-settings.service": { getCompanyBillingSettings: async () => ({ invoice: { footerNote: "Merci" } }) },
    "@/domains/company/company-logo.service": { readCompanyLogo: readLogo },
    "@/lib/pdf/invoice-pdf": {
      generateInvoicePdf: async (data: (typeof received)[number]) => { received.push(data); return new Uint8Array([1]); },
    },
    "@/lib/validations/einvoicing": {},
    "@/lib/database/claimed-settings-update": {},
    "@/services/prisma/client": { prisma: {} },
  };
  const loaded = { exports: {} as Record<string, unknown> };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/invoice/facturx/facturx.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, { Array, Buffer, Number, Object, Promise, String, exports: loaded.exports, module: loaded, require: (id: string) => deps[id] });
  const render = loaded.exports.renderClassicInvoicePdf as (loaded: unknown, legal?: unknown) => Promise<Uint8Array>;
  const invoice = {
    companyId: "company_a",
    reference: "FAC-1",
    source: null,
    pdf: { reference: "FAC-1", status: "PAID", createdAt: new Date(), paidAt: new Date("2026-10-25T09:00:00Z"), amount: 10, lineItems: [], company: { name: "Entreprise" } },
  };
  return { call: (legal?: unknown) => render(invoice, legal), received };
}

test("le relevé PDF reçoit le logo de l'entreprise, la date de paiement et le pied de page", async () => {
  const logo = Buffer.from("png");
  const { call, received } = loadRenderer(async () => logo);
  await call();
  assert.equal(received[0]!.companyLogoPng, logo);
  assert.ok(received[0]!.paidAt instanceof Date);
  assert.equal(received[0]!.footerNote, "Merci");
  assert.equal(received[0]!.legal, undefined, "relevé classique : aucune mention Factur-X");
});

test("une lecture du logo en échec ne bloque pas le relevé", async () => {
  const { call, received } = loadRenderer(async () => { throw new Error("STORAGE_DOWN"); });
  await call();
  assert.equal(received[0]!.companyLogoPng, null);
});
