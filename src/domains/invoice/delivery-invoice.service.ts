import type { Prisma } from "@prisma/client";
import { enqueueOperationJob } from "@/domains/operations/operation-job.service";
import { parseBillingSettings } from "@/domains/company/billing-settings.service";
import { createDeliveredOrderInvoice } from "@/domains/invoice/invoice.service";

/**
 * Facture créée à la livraison (DEMO-3), activable par entreprise
 * (`settings.billing.invoice.autoInvoiceOnDelivery`, désactivé par défaut).
 * La transition « Livrée » ne fait qu'inscrire une tâche durable dans sa propre
 * transaction (clé unique par commande) : la facture est émise ensuite, hors de
 * la requête du livreur ; une erreur reste visible sur la tâche (lastError,
 * santé des traitements, incident cron) et la tâche est rejouée.
 */
export const DELIVERY_INVOICE_JOB_KIND = "DELIVERY_INVOICE";

type QueueDatabase = Pick<Prisma.TransactionClient, "company" | "operationJob">;

export async function queueDeliveryInvoiceJob(
  db: QueueDatabase,
  input: { companyId: string; orderId: string }
) {
  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { settings: true },
  });
  const stored = (company?.settings ?? {}) as Record<string, unknown>;
  if (!parseBillingSettings(stored.billing).invoice.autoInvoiceOnDelivery) return null;
  return enqueueOperationJob(db, {
    jobKey: `delivery-invoice:${input.orderId}`,
    type: "CLIENT_NOTIFICATION",
    companyId: input.companyId,
    payload: { kind: DELIVERY_INVOICE_JOB_KIND, orderId: input.orderId, companyId: input.companyId },
  });
}

export async function runDeliveryInvoiceJob(payload: Prisma.JsonValue) {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const orderId = typeof value.orderId === "string" ? value.orderId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  if (!orderId || !companyId) throw new Error("DELIVERY_INVOICE_PAYLOAD_INVALID");
  return createDeliveredOrderInvoice(companyId, orderId);
}
