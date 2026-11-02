import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { prisma } from "../src/services/prisma/client";
import { submitPublicOrder } from "../src/domains/public-order/public-order.service";
import { refuseDemoInvitation, refuseIfReadOnly } from "../src/lib/api/saas-guard";

function replace(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}

const form = {
  idempotencyKey: "public-double-envoi-1",
  name: "Atelier Morel",
  email: "atelier@example.test",
  phone: "0102030405",
  pickup: { address: "1 rue du Départ", city: "Paris", postalCode: "75001", instructions: "" },
  delivery: { address: "2 rue de l'Arrivée", city: "Paris", postalCode: "75002", instructions: "" },
  packageName: "Plis",
  quantity: 1,
  requestedDeliveryDate: "2030-01-15",
};

test("C3 : un double envoi du lien public retrouve la première commande, sans en créer une seconde", async (t) => {
  replace(t, prisma.companyIntakeChannel, "findUnique", async () => ({
    orderLinkEnabled: true, companyId: "c1", company: { name: "Société", status: "ACTIVE" },
  }));
  replace(t, prisma.company, "findUnique", async () => ({ settings: {} }));
  replace(t, prisma.orderTrackingLink, "count", async () => 0);
  replace(t, prisma.orderTrackingLink, "findUnique", async () => ({ id: "l1", token: "jeton-du-premier-envoi" }));
  replace(t, prisma.operationJob, "findUnique", async () => null);

  let writes = 0;
  const lookups: unknown[] = [];
  const tx = {
    $executeRaw: async () => 0,
    orderTrackingLink: { count: async () => 0 },
    order: {
      findFirst: async ({ where }: { where: unknown }) => {
        lookups.push(where);
        return lookups.length === 1 ? null : { id: "o1", reference: "CRS-1" };
      },
    },
  };
  const createOrder = (async (_customer: unknown, _company: unknown, _user: unknown, _data: unknown, options: { beforeCreate: (db: unknown) => Promise<void> }) => {
    await options.beforeCreate(tx);
    writes += 1;
    return { id: "o1", reference: "CRS-1" };
  }) as never;

  const token = "a".repeat(32);
  const first = await submitPublicOrder(token, form, "source", { secret: "s", createOrder });
  const second = await submitPublicOrder(token, form, "source", { secret: "s", createOrder });

  assert.equal(writes, 1);
  assert.deepEqual(second, first);
  assert.equal(first.status, "created");
  assert.deepEqual(lookups[0], { companyId: "c1", customerId: null, idempotencyKey: form.idempotencyKey });
});

test("S3 : pas d'invitation depuis une entreprise de démonstration", async (t) => {
  replace(t, prisma.company, "findUnique", async () => ({ isDemo: true }));
  const refused = await refuseDemoInvitation("demo");
  assert.equal(refused?.status, 403);

  replace(t, prisma.company, "findUnique", async () => ({ isDemo: false }));
  assert.equal(await refuseDemoInvitation("c1"), null);
  assert.equal(await refuseDemoInvitation(null), null);
});

test("C4 : un abonnement expiré passe les modifications en lecture seule", async () => {
  const refused = await refuseIfReadOnly("c1", (async () => ({ canMutate: false })) as never);
  assert.equal(refused?.status, 403);
  assert.equal(await refuseIfReadOnly("c1", (async () => ({ canMutate: true })) as never), null);
});

test("C4 : chaque modification de commande, livraison et facture passe par le contrôle", () => {
  const guarded: Array<[string, number]> = [
    ["orders/[id]/route.ts", 2],
    ["deliveries/[id]/route.ts", 1],
    ["deliveries/[id]/assign/route.ts", 1],
    ["orders/[id]/tracking-link/route.ts", 1],
    ["orders/[id]/invoice/route.ts", 2],
    ["invoices/[id]/reminders/route.ts", 1],
    ["orders/intake/analyze/route.ts", 1],
    ["orders/intake/route.ts", 1],
  ];
  for (const [route, count] of guarded) {
    const source = readFileSync(`src/app/api/${route}`, "utf8");
    assert.equal(source.split("await refuseIfReadOnly(companyId)").length - 1, count, route);
  }
});

test("C2 : numéro de facture lisible et sur six chiffres, le préfixe de l'entreprise conservé", async () => {
  const { formatInvoiceReference } = await import("../src/domains/invoice/invoice.service");
  assert.equal(formatInvoiceReference("FAC", 1), "FAC-000001");
  assert.equal(formatInvoiceReference("LIV", 123456), "LIV-123456");
  assert.equal(formatInvoiceReference("FAC", 1234567), "FAC-1234567");
});
