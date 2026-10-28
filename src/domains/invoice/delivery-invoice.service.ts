import type { Prisma } from "@prisma/client";
import { enqueueOperationJob, permanentJobError } from "@/domains/operations/operation-job.service";
import { parseBillingSettings } from "@/domains/company/billing-settings.service";
import { createDeliveredOrderInvoice } from "@/domains/invoice/invoice.service";

/**
 * Facture créée à la livraison (DEMO-3), activable par entreprise
 * (`settings.billing.invoice.autoInvoiceOnDelivery`, désactivé par défaut).
 * Chaque passage en « Livrée » inscrit une tâche durable DELIVERY_INVOICE dans sa
 * propre transaction, avec une clé propre à ce passage (`passageKey` : l'événement
 * de suivi du passage) : un rejeu du même passage ne crée pas de seconde tâche, un
 * nouveau passage (après une facture annulée, par exemple) en crée une. L'unicité
 * de la facture vient du contrôle « facture active » fait sous verrou à la création.
 * La facture est émise hors de la requête du livreur ; une erreur reste visible sur
 * la tâche (lastError, exploitation, incident cron), une erreur permanente n'est
 * pas relancée.
 */
type QueueDatabase = Pick<Prisma.TransactionClient, "company" | "operationJob">;

export async function queueDeliveryInvoiceJob(
  db: QueueDatabase,
  input: { companyId: string; orderId: string; passageKey: string }
) {
  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { settings: true },
  });
  const stored = (company?.settings ?? {}) as Record<string, unknown>;
  if (!parseBillingSettings(stored.billing).invoice.autoInvoiceOnDelivery) return null;
  return enqueueOperationJob(db, {
    jobKey: `delivery-invoice:${input.orderId}:${input.passageKey}`,
    type: "DELIVERY_INVOICE",
    companyId: input.companyId,
    payload: { orderId: input.orderId, companyId: input.companyId },
  });
}

export async function runDeliveryInvoiceJob(payload: Prisma.JsonValue) {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const orderId = typeof value.orderId === "string" ? value.orderId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  if (!orderId || !companyId) throw permanentJobError("DELIVERY_INVOICE_PAYLOAD_INVALID");
  return createDeliveredOrderInvoice(companyId, orderId);
}
