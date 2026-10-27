import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import type { SignupCatalog, SignupQuote } from "../src/domains/signup/signup.service";
import {
  SALES_CODE_PATTERN,
  attributeSignupSale,
  createSalesCode,
  disableSalesCode,
  generateSalesCode,
  initialSalesLines,
  normalizeSalesCode,
  resolveActiveSalesCodeId,
} from "../src/domains/sales/sales-code.service";
import { signupActionSchema } from "../src/lib/validations/signup";
import { loadBilling } from "./helpers/billing-loader";

const { core } = loadBilling();
const catalog: SignupCatalog = {
  id: "c9", code: "C9", currency: "EUR", vatRateBps: 2000,
  plans: ["STARTER", "PRO", "BUSINESS"].map((code, i) => ({ code: code as "STARTER" | "PRO" | "BUSINESS", name: code, monthlyPriceCents: [7900, 17900, 34900][i]!, annualPriceCents: [79000, 179000, 349000][i]!, includedDriverSeats: [5, 10, 20][i]!, maxDriverSeats: [10, 30, 50][i]!, unlimitedDriverSeats: false, includedAdminSeats: i === 2 ? 2 : 1, maxAdminSeats: null, includedDispatcherSeats: i ? 1 : 0, maxDispatcherSeats: null, includedMonthlyOrders: [1000, 3000, 6000][i]!, orderOverageUnitPriceCents: [10, 8, 6][i]!, includedFeatures: i ? ["auto_dispatch"] : [] })),
  options: [
    { id: "gps", code: "AUTO", name: "Dispatch", kind: "OPTION", featureKey: "auto_dispatch", monthlyPriceCents: 2900, annualPriceCents: 34800, applicablePlans: ["STARTER", "PRO", "BUSINESS"] },
    { id: "driver", code: "DRIVER_BUSINESS", name: "Livreur", kind: "DRIVER_SEAT", featureKey: null, monthlyPriceCents: 900, annualPriceCents: 10800, applicablePlans: ["BUSINESS"] },
  ],
};

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.22.0", meta: { target } });
}

test("SALES-1 codes : format lisible, sans caractère ambigu, saisie tolérante à la casse", () => {
  const sequence = [0, 8, 23, 31];
  let index = 0;
  const code = generateSalesCode("Élodie Martin-Durand", () => sequence[index++]!);
  assert.equal(code, "ELODIEMA-AJZ9");
  assert.match(code, SALES_CODE_PATTERN);
  assert.equal(generateSalesCode("Ō", () => 0), "TL-AAAA", "un nom sans lettres latines garde un préfixe valide");
  for (let run = 0; run < 200; run += 1) assert.match(generateSalesCode("Camille"), /^CAMILLE-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeSalesCode("  elodiema-ajz9 "), "ELODIEMA-AJZ9");
  for (const invalid of ["", "AB", "ELODIEMA-AJZ0", "ELODIEMA-AJZI", "E-ABCD", "ELODIEMAR-ABCD", "ELODIE MA-ABCD", "1234-ABCD"]) {
    assert.equal(normalizeSalesCode(invalid), null, invalid);
  }
});

test("SALES-1 codes : création par le super-administrateur, un seul code par commercial", async () => {
  const created: Array<Record<string, unknown>> = [];
  const failures = [uniqueError(["code"]), null];
  const db = {
    salesCode: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const failure = failures.shift();
        if (failure) throw failure;
        created.push(data);
        return { id: "code-1", ...data, disabledAt: null, createdAt: new Date() };
      },
    },
  } as never;
  const result = await createSalesCode({ sellerName: "Camille Roy", sellerEmail: " Camille@Example.invalid ", level: "ASSISTED" }, "platform-1", { db, random: () => 1 });
  assert.equal(result.status, "created");
  assert.equal(created.length, 1, "une collision de suffixe est réessayée");
  assert.deepEqual(created[0], { sellerName: "Camille Roy", sellerEmail: "camille@example.invalid", level: "ASSISTED", code: "CAMILLER-BBBB", createdById: "platform-1" });

  const sameSeller = { salesCode: { create: async () => { throw uniqueError(["seller_email"]); } } } as never;
  assert.deepEqual(await createSalesCode({ sellerName: "Camille Roy", sellerEmail: "camille@example.invalid", level: "REFERRER" }, "platform-1", { db: sameSeller }), { status: "seller_has_code" });

  const alwaysTaken = { salesCode: { create: async () => { throw uniqueError(["code"]); } } } as never;
  await assert.rejects(createSalesCode({ sellerName: "Camille Roy", sellerEmail: "x@example.invalid", level: "REFERRER" }, "platform-1", { db: alwaysTaken }), /SALES_CODE_GENERATION_EXHAUSTED/);

  const broken = { salesCode: { create: async () => { throw new Error("db down"); } } } as never;
  await assert.rejects(createSalesCode({ sellerName: "Camille Roy", sellerEmail: "x@example.invalid", level: "REFERRER" }, "platform-1", { db: broken }), /db down/);

  for (const [body, field] of [
    [{ sellerName: "C", sellerEmail: "x@example.invalid", level: "REFERRER" }, "sellerName"],
    [{ sellerName: "Camille", sellerEmail: "pas-un-email", level: "REFERRER" }, "sellerEmail"],
    [{ sellerName: "Camille", sellerEmail: "x@example.invalid", level: "PARTNER" }, "level"],
    [{ sellerName: "Camille", sellerEmail: "x@example.invalid", level: "REFERRER", code: "CHOISI-AAAA" }, ""],
  ] as const) {
    assert.deepEqual(await createSalesCode(body, "platform-1", { db: broken }), { status: "invalid", field });
  }
});

test("SALES-1 codes : désactivation à tout moment, jamais réactivée en silence", async () => {
  const rows = new Map<string, { disabledAt: Date | null; disabledById: string | null }>([["code-1", { disabledAt: null, disabledById: null }]]);
  const db = {
    salesCode: {
      updateMany: async ({ where, data }: { where: { id: string; disabledAt: null }; data: { disabledAt: Date; disabledById: string } }) => {
        const row = rows.get(where.id);
        if (!row || row.disabledAt) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => (rows.has(where.id) ? { id: where.id } : null),
    },
  } as never;
  const now = new Date("2026-10-27T12:00:00.000Z");
  assert.deepEqual(await disableSalesCode("code-1", "platform-2", now, db), { status: "disabled" });
  assert.deepEqual(rows.get("code-1"), { disabledAt: now, disabledById: "platform-2" });
  assert.deepEqual(await disableSalesCode("code-1", "platform-3", new Date(), db), { status: "already_disabled" });
  assert.equal(rows.get("code-1")?.disabledById, "platform-2", "la première désactivation reste tracée");
  assert.deepEqual(await disableSalesCode("absent", "platform-2", now, db), { status: "not_found" });
});

test("SALES-1 codes : seul un code existant et actif est accepté à l'inscription", async () => {
  const db = {
    salesCode: {
      findUnique: async ({ where }: { where: { code: string } }) => ({
        "CAMILLER-BBBB": { id: "code-1", disabledAt: null },
        "ANCIEN-CCCC": { id: "code-2", disabledAt: new Date("2026-10-01T00:00:00.000Z") },
      } as Record<string, { id: string; disabledAt: Date | null }>)[where.code] ?? null,
    },
  } as never;
  assert.equal(await resolveActiveSalesCodeId(" camiller-bbbb ", db), "code-1");
  for (const raw of ["ANCIEN-CCCC", "INCONNU-DDDD", "n'importe quoi"]) {
    await assert.rejects(resolveActiveSalesCodeId(raw, db), /SALES_CODE_INVALID/, raw);
  }

  assert.equal(signupActionSchema.safeParse({ action: "create", planCode: "PRO", billingInterval: "MONTHLY", salesCode: "CAMILLER-BBBB" }).success, true);
  assert.equal(signupActionSchema.safeParse({ action: "selection", planCode: "PRO", billingInterval: "MONTHLY", salesCode: null }).success, true);
  assert.equal(signupActionSchema.safeParse({ action: "create", planCode: "PRO", billingInterval: "MONTHLY", salesCode: "X".repeat(25) }).success, false);
});

test("SALES-1 attribution : les lignes initiales sont exactement celles du contrat de facturation", () => {
  for (const [plan, interval, selections] of [
    ["STARTER", "MONTHLY", [{ code: "AUTO", quantity: 1 }]],
    ["BUSINESS", "ANNUAL", [{ code: "DRIVER_BUSINESS", quantity: 3 }]],
    ["PRO", "MONTHLY", []],
  ] as const) {
    const contract = core.makeBillingContract(catalog, plan, interval, [...selections]);
    assert.deepEqual(JSON.parse(JSON.stringify(initialSalesLines(contract.quote, catalog.options))), JSON.parse(JSON.stringify(contract.lines)), `${plan} ${interval}`);
  }
});

test("SALES-1 attribution : figée à l'activation, sans bloquer un client qui a payé", async () => {
  const quote = core.makeBillingContract(catalog, "STARTER", "MONTHLY", [{ code: "AUTO", quantity: 1 }]).quote as SignupQuote;
  const now = new Date("2026-01-31T10:00:00.000Z");
  const attributions: Array<Record<string, unknown>> = [];
  const codes: Record<string, { id: string; level: string; disabledAt: Date | null }> = {
    active: { id: "active", level: "ASSISTED", disabledAt: null },
    disabled: { id: "disabled", level: "AUTONOMOUS", disabledAt: new Date("2026-01-30T00:00:00.000Z") },
  };
  const tx = {
    salesCode: { findUnique: async ({ where }: { where: { id: string } }) => codes[where.id] ?? null },
    salesAttribution: { create: async ({ data }: { data: Record<string, unknown> }) => { attributions.push(data); return data; } },
  } as never;
  const base = { signupId: "signup-1", companyId: "company-1", quote, options: catalog.options, now };

  assert.deepEqual(await attributeSignupSale(tx, { ...base, salesCodeId: null }), { status: "none" });
  assert.deepEqual(await attributeSignupSale(tx, { ...base, salesCodeId: "disabled" }), { status: "code_disabled" }, "désactivé avant l'activation : aucune attribution");
  assert.equal(attributions.length, 0);

  assert.deepEqual(await attributeSignupSale(tx, { ...base, salesCodeId: "active" }), { status: "attributed", rateBps: 2500 });
  const stored = attributions[0]!;
  assert.equal(stored.companyId, "company-1");
  assert.equal(stored.salesCodeId, "active");
  assert.equal(stored.signupId, "signup-1");
  assert.equal(stored.level, "ASSISTED");
  assert.equal(stored.rateBps, 2500);
  assert.equal((stored.eligibleUntil as Date).toISOString(), "2027-01-31T10:00:00.000Z", "douze mois exactement");
  const snapshot = stored.snapshot as { sellerReference: string; eligibleLines: unknown[]; initialContractHash: string };
  assert.equal(snapshot.sellerReference, "active");
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.eligibleLines)), [
    { code: "plan:STARTER", name: "STARTER", quantity: 1, unitHtCents: 7900 },
    { code: "AUTO", name: "Dispatch", quantity: 1, unitHtCents: 2900 },
  ]);
  assert.match(snapshot.initialContractHash, /^[a-f0-9]{64}$/);

  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const broken = { ...quote, selections: [{ code: "SUPPRIMEE", quantity: 1 }] };
    assert.deepEqual(await attributeSignupSale(tx, { ...base, quote: broken, salesCodeId: "active" }), { status: "snapshot_failed" });
  } finally {
    console.error = originalError;
  }
  assert.equal(attributions.length, 1, "aucune attribution partielle");
  assert.equal(errors.length, 1);
});

test("SALES-1 inscription : code saisi côté serveur, attribution dans la transaction d'activation", () => {
  const service = readFileSync("src/domains/signup/signup.service.ts", "utf8");
  const activation = service.slice(service.indexOf("export async function activateSignupJourney"));
  assert.ok(activation.indexOf("await attributeSignupSale(tx,") > 0, "attribution dans la transaction");
  assert.ok(activation.indexOf("await attributeSignupSale(tx,") < activation.indexOf('status: "ACTIVATED"'), "avant le passage à ACTIVATED");
  assert.match(activation, /salesCodeId: journey\.salesCodeId/, "le code vient du brouillon serveur, jamais du navigateur à l'activation");
  assert.match(service, /salesCodeApplied: Boolean\(journey\.salesCodeId\)/, "l'identifiant interne du code n'est pas exposé");
  const route = readFileSync("src/app/api/signup/route.ts", "utf8");
  assert.ok(route.indexOf('"SALES_CODE_INVALID"') < route.indexOf('code.includes("INVALID")'), "message explicite avant le message générique");
});
