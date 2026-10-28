import type { InvoiceStatus } from "@prisma/client";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-status";

export type PaymentTone = "success" | "warning" | "error";

export function invoiceRowStatusLabel(row: { status: InvoiceStatus; daysOverdue: number }): string {
  if (row.status === "OVERDUE" && row.daysOverdue > 0) return `En retard · ${row.daysOverdue} j`;
  return INVOICE_STATUS_LABELS[row.status];
}

const REMINDER_LABELS: Record<string, { label: string; tone: PaymentTone }> = {
  QUEUED: { label: "Relance en cours d'envoi", tone: "success" },
  SENT: { label: "Relance envoyée", tone: "success" },
  FAILED: { label: "Échec d'envoi de la relance", tone: "error" },
  NOT_SENT_EMAIL_NOT_CONFIGURED: { label: "Relance non envoyée : e-mail non configuré", tone: "warning" },
  NOT_SENT_NO_RECIPIENT: { label: "Relance non envoyée : client sans adresse e-mail", tone: "warning" },
  NOT_SENT_CLIENT_PREFERENCES: { label: "Relance non envoyée : le client a désactivé ces e-mails", tone: "warning" },
  NOT_SENT_INVOICE_SETTLED: { label: "Relance annulée : facture réglée entre-temps", tone: "warning" },
  SKIPPED_SUPERSEDED: { label: "Relance non envoyée : remplacée par une relance plus récente", tone: "warning" },
};

export function reminderResultLabel(result: string): { label: string; tone: PaymentTone } {
  return REMINDER_LABELS[result] ?? { label: "Relance tracée", tone: "warning" };
}

export function reminderOutcomeMessage(outcome: { duplicate: boolean; reminder: { result: string } }): {
  kind: "success" | "info" | "warning";
  text: string;
} {
  // Une tentative non envoyée ne compte pas comme une relance : on dit qu'elle reste non envoyée.
  const notSentReason: Record<string, string> = {
    NOT_SENT_EMAIL_NOT_CONFIGURED: "e-mail non configuré",
    NOT_SENT_NO_RECIPIENT: "client sans e-mail",
  };
  if (outcome.duplicate && notSentReason[outcome.reminder.result]) {
    return { kind: "warning", text: `Relance déjà tracée, toujours non envoyée : ${notSentReason[outcome.reminder.result]}.` };
  }
  if (outcome.duplicate) {
    return { kind: "info", text: "Déjà relancée dans les dernières 24 h : aucune nouvelle relance envoyée." };
  }
  switch (outcome.reminder.result) {
    case "QUEUED":
    case "SENT":
      return { kind: "success", text: "Relance envoyée au client." };
    case "NOT_SENT_EMAIL_NOT_CONFIGURED":
      return { kind: "warning", text: "Relance tracée, non envoyée : l'envoi d'e-mails n'est pas configuré." };
    case "NOT_SENT_NO_RECIPIENT":
      return { kind: "warning", text: "Relance tracée, non envoyée : le client n'a pas d'adresse e-mail." };
    default:
      return { kind: "warning", text: reminderResultLabel(outcome.reminder.result).label };
  }
}
