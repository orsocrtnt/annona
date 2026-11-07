/**
 * FACT-1 — clés des tâches d'envoi d'une facture par e-mail (ADM-10). Une tâche durable par tentative
 * demandée : la première à l'émission, puis une nouvelle à chaque « Renvoyer ». La clé sert aussi de clé
 * d'idempotence du fournisseur : une reprise de la même tâche n'envoie jamais deux fois.
 */
export const INVOICE_EMAIL_KIND = "INVOICE_EMAIL";

export const invoiceEmailJobPrefix = (invoiceId: string) => `client-notification:invoice-email:${invoiceId}:`;

export function invoiceEmailJobKey(invoiceId: string, attempt: number) {
  return `${invoiceEmailJobPrefix(invoiceId)}${attempt}`;
}

/** Numéro de tentative lu dans la clé (0 si illisible). */
export function invoiceEmailAttempt(jobKey: string): number {
  const value = Number(jobKey.split(":").pop());
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** Entité du journal (AuditLog) pour l'émission et les règlements d'une facture. */
export const INVOICE_AUDIT_ENTITY = "Invoice";
