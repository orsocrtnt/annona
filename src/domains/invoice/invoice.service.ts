import { prisma } from "@/services/prisma/client";
import type { Prisma } from "@prisma/client";
import type { CreateOrderInvoiceInput, InvoiceLineItem } from "@/lib/validations/invoice";
import {
  getCompanyTariffSettings,
  findTariffZoneForPostalCode,
} from "@/domains/company/tariff-settings.service";
import { getCompanyBillingSettings } from "@/domains/company/billing-settings.service";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/constants/order-status";

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

  if (vatRate > 0 && lines.length > 0) {
    const subtotalHT = lines.reduce((sum, line) => sum + line.amount * line.quantity, 0);
    const vatAmount = Math.round(subtotalHT * vatRate) / 100;
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
  return lines.reduce((sum, line) => sum + line.amount * line.quantity, 0);
}

export async function createOrderInvoice(
  companyId: string,
  orderId: string,
  input: CreateOrderInvoiceInput
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: true, invoices: true, deliveries: true },
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
  const dueDate = input.dueDate
    ? new Date(input.dueDate)
    : new Date(Date.now() + billing.invoice.defaultDueDays * 24 * 60 * 60 * 1000);

  const existingDraft = order.invoices.find(
    (inv) => inv.status === "DRAFT" || inv.status === "PENDING"
  );

  return prisma.$transaction(async (tx) => {
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

    await tx.order.update({
      where: { id: orderId },
      data: { status: "INVOICED" },
    });

    for (const delivery of order.deliveries) {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: "INVOICED" },
      });
      await tx.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          label: FULFILLMENT_STATUS_LABELS.INVOICED,
          description: "Facture émise par l'administrateur",
        },
      });
    }

    return invoice;
  });
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

export async function getClientInvoices(customerId: string) {
  return prisma.invoice.findMany({
    where: { customerId },
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
  });
}

export async function getClientInvoiceById(customerId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, customerId },
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

