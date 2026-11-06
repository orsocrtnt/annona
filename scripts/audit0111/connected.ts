/**
 * Corrections de l'audit du 1er novembre 2026 sur PostgreSQL RÉEL (annona-dev uniquement), hors `npm run check` :
 *   npx dotenv -e .env.local -- npx tsx scripts/audit0111/connected.ts
 * Numéros de facture concurrents (C2), double envoi du lien public (C3), états de commande (C1), prix de
 * course (FACT-KM), facture automatique non émise (FACT-AUTO-VIDE). Entreprises `e2e-audit-*`, supprimées à la fin.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateDevEnvironment } from "../env2/verify-dev-env";

async function main() {
  const envErrors = validateDevEnvironment(process.env);
  if (envErrors.length) {
    console.log(JSON.stringify({ passed: false, reason: "ENVIRONNEMENT_NON_DEV", errors: envErrors }));
    process.exitCode = 2;
    return;
  }
  process.env.DATABASE_CONNECTION_LIMIT = "5";
  const { prisma } = await import("../../src/services/prisma/client");
  const { createOrderInvoice, createDeliveredOrderInvoice } = await import("../../src/domains/invoice/invoice.service");
  const { listUnissuedDeliveryInvoices } = await import("../../src/domains/invoice/company-invoices.service");
  const { updateCompanyOrderStatus } = await import("../../src/domains/order/order.service");
  const { submitPublicOrder } = await import("../../src/domains/public-order/public-order.service");
  const { activateManualPilot } = await import("../../src/domains/saas/saas.service");
  const { enqueueOperationJob, processOperationJob } = await import("../../src/domains/operations/operation-job.service");

  const tag = randomUUID().slice(0, 8);
  const report: Record<string, unknown> = { tag };
  const companyIds: string[] = [];
  const newCompany = async (name: string, settings: object) => {
    const company = await prisma.company.create({ data: { name: `E2E AUDIT ${name} ${tag}`, slug: `e2e-audit-${name}-${tag}`, settings } });
    companyIds.push(company.id);
    return company.id;
  };
  let sequence = 0;
  const newOrder = async (companyId: string, status: "DELIVERED" | "CANCELLED" | "FAILED" | "PENDING", extra: Record<string, unknown> = {}, driverId?: string) => {
    sequence += 1;
    return prisma.order.create({
      data: {
        reference: `E2E-AUDIT-${tag}-${sequence}`, totalAmount: 0, status, companyId, shippingAddress: "10 rue de Rivoli", shippingCity: "Paris", shippingPostalCode: "75004", ...extra,
        deliveries: { create: {
          reference: `E2E-AUDIT-LIV-${tag}-${sequence}`, status, address: "10 rue de Rivoli", companyId,
          ...(driverId ? { driverId, driverName: "Chauffeur Ancien", missionStartedAt: new Date(), completedAt: new Date() } : {}),
        } },
      },
    });
  };

  try {
    // C2 : six factures simultanées, une suite sans trou ni doublon, propre à chaque entreprise.
    const companyA = await newCompany("a", {});
    const companyB = await newCompany("b", {});
    const line = { feeIds: [], includePurchases: false, customLines: [{ label: "Prestation E2E", amount: 10 }] };
    const orders = await Promise.all(Array.from({ length: 6 }, () => newOrder(companyA, "DELIVERED")));
    const invoices = await Promise.all(orders.map((order) => createOrderInvoice(companyA, order.id, line)));
    const references = invoices.map((invoice) => invoice!.reference).sort();
    assert.deepEqual(references, ["FAC-000001", "FAC-000002", "FAC-000003", "FAC-000004", "FAC-000005", "FAC-000006"]);
    const orderB = await newOrder(companyB, "DELIVERED");
    assert.equal((await createOrderInvoice(companyB, orderB.id, line))!.reference, "FAC-000001");
    const again = await createOrderInvoice(companyA, orders[0]!.id, line);
    assert.equal(again!.id, invoices[0]!.id, "une réémission garde son numéro");
    report.c2 = references;

    // C1 : refus sur la vraie base, et replanification d'un échec.
    const cancelled = await newOrder(companyA, "CANCELLED");
    await assert.rejects(() => updateCompanyOrderStatus(companyA, cancelled.id, "DELIVERED"), /ORDER_STATUS_TRANSITION_INVALID/);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: cancelled.id } })).status, "CANCELLED");
    const role = await prisma.role.findUniqueOrThrow({ where: { slug: "driver" }, select: { id: true } });
    const driver = await prisma.user.create({ data: { authId: `e2e-audit-${tag}`, email: `livreur@e2e-audit-${tag}.invalid`, firstName: "E2E", lastName: "Livreur", status: "ACTIVE", roleId: role.id, companyId: companyA } });
    const failed = await newOrder(companyA, "FAILED", {}, driver.id);
    await updateCompanyOrderStatus(companyA, failed.id, "PENDING");
    const replanned = await prisma.delivery.findFirstOrThrow({ where: { orderId: failed.id } });
    assert.equal(replanned.status, "PENDING");
    assert.equal(replanned.driverId, null);
    assert.equal(replanned.missionStartedAt, null);
    assert.equal(replanned.completedAt, null);
    assert.ok(await prisma.trackingEvent.count({ where: { deliveryId: replanned.id } }) >= 1, "l'historique reste");
    report.c1 = "ok";

    // C3 : deux envois simultanés du même formulaire, une seule commande.
    const now = new Date();
    await activateManualPilot({
      companyId: companyB, startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 86_400_000),
      limits: { drivers: 5, admins: 1, dispatchers: 1, monthlyOrders: 100 },
    });
    const token = `e2e-audit-${tag}-lien-public`;
    await prisma.companyIntakeChannel.create({ data: { companyId: companyB, orderLinkToken: token, orderLinkEnabled: true } });
    const form = {
      idempotencyKey: `e2e-audit-${tag}`, name: "E2E Audit", email: `demandeur@e2e-audit-${tag}.invalid`, phone: "0102030405",
      pickup: { address: "1 rue de Rivoli", city: "Paris", postalCode: "75001", instructions: "" },
      delivery: { address: "10 boulevard Voltaire", city: "Paris", postalCode: "75011", instructions: "" },
      packageName: "Plis", quantity: 1, requestedDeliveryDate: new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10),
    };
    const sends = await Promise.all([1, 2, 3].map(() => submitPublicOrder(token, form, `e2e-audit-source-${tag}`)));
    const created = await prisma.order.count({ where: { companyId: companyB, source: "PUBLIC_LINK" } });
    assert.equal(created, 1, `une seule commande, reçu : ${JSON.stringify(sends.map((send) => send.status))}`);
    assert.deepEqual(sends.map((send) => send.status), ["created", "created", "created"]);
    report.c3 = sends.map((send) => send.status);

    // FACT-KM : prix annoncé repris sur la facture automatique d'une course.
    const companyC = await newCompany("c", { billing: { courier: { showClientEstimate: true }, invoice: { autoInvoiceOnDelivery: true } } });
    const course = await newOrder(companyC, "DELIVERED", {
      deliveryCategory: "COURIER", pickupAddress: "1 rue de Rivoli", pickupCity: "Paris", pickupPostalCode: "75001",
      shippingAddress: "10 boulevard Voltaire", shippingCity: "Paris", shippingPostalCode: "75011",
    });
    const result = await createDeliveredOrderInvoice(companyC, course.id);
    assert.equal(result.status, "created", JSON.stringify(result));
    const courseInvoice = await prisma.invoice.findFirstOrThrow({ where: { orderId: course.id } });
    const lines = courseInvoice.lineItems as Array<{ label: string; total?: number; unitPrice?: number }>;
    assert.match(lines[0]!.label, /^Course, environ/);
    report.factKm = { reference: courseInvoice.reference, lines };

    // FACT-AUTO-VIDE : sans zone ni achat, la tâche échoue et l'entreprise le voit.
    const companyD = await newCompany("d", { billing: { invoice: { autoInvoiceOnDelivery: true } } });
    const empty = await newOrder(companyD, "DELIVERED");
    const job = await enqueueOperationJob(prisma, { jobKey: `delivery-invoice:${empty.id}:e2e`, type: "DELIVERY_INVOICE", companyId: companyD, payload: { orderId: empty.id, companyId: companyD } });
    const processed = await processOperationJob(job.id);
    assert.equal(processed?.status, "FAILED");
    assert.equal(processed?.lastError, "DELIVERY_INVOICE_EMPTY");
    const unissued = await listUnissuedDeliveryInvoices(companyD);
    assert.equal(unissued.length, 1);
    assert.equal(unissued[0]!.orderId, empty.id);
    await createOrderInvoice(companyD, empty.id, line);
    assert.deepEqual(await listUnissuedDeliveryInvoices(companyD), [], "émise à la main : plus signalée");
    report.factAutoVide = unissued[0]!.reason;
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message.slice(0, 900) : String(error);
    process.exitCode = 1;
  } finally {
    for (const companyId of companyIds) {
      await prisma.invoice.deleteMany({ where: { companyId } });
      await prisma.operationJob.deleteMany({ where: { companyId } });
      await prisma.orderTrackingLink.deleteMany({ where: { companyId } });
      await prisma.trackingEvent.deleteMany({ where: { delivery: { companyId } } });
      await prisma.delivery.deleteMany({ where: { companyId } });
      await prisma.order.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.companyIntakeChannel.deleteMany({ where: { companyId } });
      await prisma.saasSubscription.deleteMany({ where: { companyId } }).catch(() => undefined);
      await prisma.company.delete({ where: { id: companyId } }).catch((error: Error) => { report.cleanupError = error.message.slice(0, 300); });
    }
    report.residualCompanies = await prisma.company.count({ where: { slug: { contains: tag } } });
    await prisma.$disconnect();
    console.log(JSON.stringify(report, null, 1));
  }
}

void main();
