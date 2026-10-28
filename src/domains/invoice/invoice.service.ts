import { prisma } from "@/services/prisma/client";
import { Prisma } from "@prisma/client";
import type { CreateOrderInvoiceInput, InvoiceLineItem } from "@/lib/validations/invoice";
import {
  getCompanyTariffSettings,
  findTariffZoneForPostalCode,
} from "@/domains/company/tariff-settings.service";
import { getCompanyBillingSettings } from "@/domains/company/billing-settings.service";
import { CLIENT_INVOICES_TAKE } from "@/lib/query/list-limits";
import { queueInvoiceIssuedNotification } from "@/domains/client-portal/notify.service";
import { kickOperationJob } from "@/domains/operations/operation-job.service";
import { isInvoiceOutstanding, OUTSTANDING_INVOICE_STATUSES } from "@/domains/invoice/invoice-due";

function generateInvoiceReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function buildInvoiceLineItems(
  order: {
    items: { name: string; quantity: number; unitPrice: Prisma.Decimal | number }[];
    shippingPostalCode: string | null;
  },
  tariffs: Awaited<ReturnType<typeof getCompanyTariffSettings>>,
  input: CreateOrderInvoiceInput,
  vatRate = 0
): InvoiceLineItem[] {
  const lines: InvoiceLineItem[] = [];

  if (input.zoneId) {
    const zone = tariffs.tariffZones.find((z) => z.id === input.zoneId);
    if (zone) {
      lines.push({
        label: `Livraison — ${zone.name}`,
        amount: zone.price,
        quantity: 1,
        sourceType: "ZONE",
        sourceId: zone.id,
      });
    }
  }

  for (const feeId of input.feeIds) {
    const fee = tariffs.tariffFees.find((f) => f.id === feeId);
    if (fee) {
      lines.push({
        label: fee.name,
        amount: fee.price,
        quantity: 1,
        sourceType: "FEE",
        sourceId: fee.id,
      });
    }
  }

  if (input.includePurchases) {
    for (const item of order.items) {
      const unitPrice = Number(item.unitPrice);
      if (unitPrice <= 0) continue;
      lines.push({
        label: `${item.name} × ${item.quantity}`,
        amount: unitPrice,
        quantity: item.quantity,
        sourceType: "PURCHASE",
      });
    }
  }

  for (const custom of input.customLines) {
    lines.push({
      label: custom.label,
      amount: custom.amount,
      quantity: 1,
      sourceType: "CUSTOM",
    });
  }

  // Save rounded unit prices, so the saved lines exactly explain the saved total.
  for (const line of lines) {
    line.amount = new Prisma.Decimal(String(line.amount)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }
  if (vatRate > 0 && lines.length > 0) {
    const subtotalHT = new Prisma.Decimal(String(computeInvoiceTotal(lines)));
    const vatAmount = subtotalHT.times(String(vatRate)).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
    if (vatAmount > 0) {
      lines.push({
        label: `TVA (${vatRate}%)`,
        amount: vatAmount,
        quantity: 1,
        sourceType: "VAT",
      });
    }
  }

  return lines;
}

export function computeInvoiceTotal(lines: InvoiceLineItem[]): number {
  return lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(String(line.amount)).times(line.quantity)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)), new Prisma.Decimal(0)).toNumber();
}

export async function createOrderInvoice(
  companyId: string,
  orderId: string,
  input: CreateOrderInvoiceInput
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: true, invoices: true },
  });
  if (!order) return null;

  const paidInvoice = order.invoices.find((inv) => inv.status === "PAID");
  if (paidInvoice) throw new Error("INVOICE_ALREADY_PAID");

  const [tariffs, billing] = await Promise.all([
    getCompanyTariffSettings(companyId),
    getCompanyBillingSettings(companyId),
  ]);
  const lineItems = buildInvoiceLineItems(order, tariffs, input, billing.invoice.vatRate);

  if (input.zoneId && !lineItems.some((l) => l.sourceType === "ZONE")) {
    throw new Error("ZONE_NOT_FOUND");
  }

  if (lineItems.length === 0) {
    if (input.includePurchases) {
      throw new Error("PURCHASES_EMPTY");
    }
    throw new Error("INVOICE_EMPTY");
  }

  const amount = computeInvoiceTotal(lineItems);
  if (amount > 99_999_999.99) throw new Error("INVOICE_AMOUNT_TOO_LARGE");
  const dueDate = input.dueDate
    ? new Date(input.dueDate)
    : new Date(Date.now() + billing.invoice.defaultDueDays * 24 * 60 * 60 * 1000);

  const { invoice, notificationJobId } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${order.id} FOR UPDATE`;
    const currentInvoices = await tx.invoice.findMany({ where: { orderId: order.id } });
    if (currentInvoices.some((candidate) => candidate.status === "PAID")) {
      throw new Error("INVOICE_ALREADY_PAID");
    }
    // Une facture en retard est réémise comme une facture en attente (jamais doublée).
    const existingDraft = currentInvoices.find(
      (candidate) => candidate.status === "DRAFT" || isInvoiceOutstanding(candidate.status)
    );
    let invoice;

    if (existingDraft) {
      invoice = await tx.invoice.update({
        where: { id: existingDraft.id },
        data: {
          amount,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          notes: input.notes ?? null,
          status: "PENDING",
          dueDate,
        },
      });
    } else {
      invoice = await tx.invoice.create({
        data: {
          reference: generateInvoiceReference(billing.invoice.referencePrefix),
          status: "PENDING",
          amount,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          notes: input.notes ?? null,
          dueDate,
          companyId,
          orderId: order.id,
          customerId: order.customerId,
        },
      });
    }

    const notificationJob = await queueInvoiceIssuedNotification(tx, {
      customerId: invoice.customerId,
      companyId,
      reference: invoice.reference,
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
    });

    return { invoice, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (notificationJobId) kickOperationJob(notificationJobId);

  return invoice;
}

export type DeliveredOrderInvoiceResult =
  | { status: "created"; invoiceId: string }
  | { status: "skipped"; reason: "ORDER_NOT_FOUND" | "ORDER_NOT_DELIVERED" | "INVOICE_EXISTS" | "SETTING_DISABLED" };

/**
 * DEMO-3 : facture émise automatiquement pour une commande livrée, avec les mêmes
 * valeurs par défaut que le formulaire manuel (zone suggérée par le code postal,
 * achats validés par le livreur, délai de paiement de l'entreprise). Une facture
 * par commande, comme aujourd'hui : si la commande en a déjà une (manuelle ou
 * automatique, quel que soit son statut), rien n'est créé ni modifié.
 */
export async function createDeliveredOrderInvoice(
  companyId: string,
  orderId: string
): Promise<DeliveredOrderInvoiceResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: true, invoices: { select: { id: true } } },
  });
  if (!order) return { status: "skipped", reason: "ORDER_NOT_FOUND" };
  if (order.status !== "DELIVERED") return { status: "skipped", reason: "ORDER_NOT_DELIVERED" };
  if (order.invoices.length > 0) return { status: "skipped", reason: "INVOICE_EXISTS" };

  const [tariffs, billing] = await Promise.all([
    getCompanyTariffSettings(companyId),
    getCompanyBillingSettings(companyId),
  ]);
  // Réglage relu au moment du traitement : coupé entre-temps, rien n'est émis.
  if (!billing.invoice.autoInvoiceOnDelivery) return { status: "skipped", reason: "SETTING_DISABLED" };

  const zone = findTariffZoneForPostalCode(order.shippingPostalCode, tariffs.tariffZones);
  const lineItems = buildInvoiceLineItems(
    order,
    tariffs,
    {
      zoneId: zone?.id,
      feeIds: [],
      includePurchases: order.items.some((item) => Number(item.unitPrice) > 0),
      customLines: [],
    },
    billing.invoice.vatRate
  );
  if (lineItems.length === 0) throw new Error("DELIVERY_INVOICE_EMPTY");
  const amount = computeInvoiceTotal(lineItems);
  if (amount > 99_999_999.99) throw new Error("INVOICE_AMOUNT_TOO_LARGE");
  const dueDate = new Date(Date.now() + billing.invoice.defaultDueDays * 24 * 60 * 60 * 1000);

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${order.id} AND company_id = ${companyId} FOR UPDATE`;
    // Revérifié sous verrou : deux traitements concurrents ne créent jamais deux factures.
    const existing = await tx.invoice.findMany({ where: { orderId: order.id } });
    if (existing.length > 0) return null;
    const invoice = await tx.invoice.create({
      data: {
        reference: generateInvoiceReference(billing.invoice.referencePrefix),
        status: "PENDING",
        amount,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        notes: null,
        dueDate,
        companyId,
        orderId: order.id,
        customerId: order.customerId,
      },
    });
    const notificationJob = await queueInvoiceIssuedNotification(tx, {
      customerId: invoice.customerId,
      companyId,
      reference: invoice.reference,
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
    });
    return { invoiceId: invoice.id, notificationJobId: notificationJob?.id ?? null };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!outcome) return { status: "skipped", reason: "INVOICE_EXISTS" };
  if (outcome.notificationJobId) kickOperationJob(outcome.notificationJobId);
  return { status: "created", invoiceId: outcome.invoiceId };
}

export async function getOrderInvoicePreview(
  companyId: string,
  orderId: string,
  input: CreateOrderInvoiceInput
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: true },
  });
  if (!order) return null;

  const [tariffs, billing] = await Promise.all([
    getCompanyTariffSettings(companyId),
    getCompanyBillingSettings(companyId),
  ]);
  const lineItems = buildInvoiceLineItems(order, tariffs, input, billing.invoice.vatRate);
  const suggestedZone = findTariffZoneForPostalCode(
    order.shippingPostalCode,
    tariffs.tariffZones
  );

  return {
    lineItems,
    total: computeInvoiceTotal(lineItems),
    suggestedZoneId: suggestedZone?.id ?? null,
    tariffs,
  };
}

export async function getClientInvoices(customerId: string, companyId: string) {
  return prisma.invoice.findMany({
    where: { customerId, companyId },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          status: true,
          deliveryCategory: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: CLIENT_INVOICES_TAKE,
  });
}

export async function getClientInvoiceById(
  customerId: string,
  companyId: string,
  invoiceId: string
) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, customerId, companyId },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          totalAmount: true,
          status: true,
          deliveryCategory: true,
        },
      },
      company: { select: { name: true, email: true, address: true, city: true } },
    },
  });
}

/** Le règlement ne modifie jamais la commande, la mission ni leurs dates. */
export async function markOrderInvoicePaid(
  companyId: string,
  orderId: string,
  invoiceId: string,
  expectedUpdatedAt: Date
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} AND company_id = ${companyId} FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, orderId, companyId } });
    if (!invoice) return null;
    if (invoice.status === "PAID") return invoice;
    // Une facture en retard reste à régler : elle se paie comme une facture en attente.
    if (!isInvoiceOutstanding(invoice.status)) throw new Error("INVOICE_NOT_PAYABLE");
    const claim = await tx.invoice.updateMany({
      // PENDING ou OVERDUE : le passage en retard par le cron n'est pas une édition concurrente.
      where: { id: invoiceId, orderId, companyId, status: { in: [...OUTSTANDING_INVOICE_STATUSES] }, updatedAt: expectedUpdatedAt },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claim.count !== 1) throw new Error("INVOICE_STATUS_CONFLICT");
    return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  }, { maxWait: 10_000, timeout: 30_000 });
}
