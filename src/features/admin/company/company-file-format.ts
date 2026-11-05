import type { SystemRole } from "@prisma/client";

/** Libellés et formats de la fiche entreprise (ADMIN-ESPACE lot 3). Dates et heures à Paris. */

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspendue",
  TRIAL: "Essai",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  ACTIVE: "Actif",
  PAST_DUE: "Impayé",
  RESTRICTED: "Restreint",
  READ_ONLY: "Lecture seule",
  CANCEL_AT_PERIOD_END: "Résiliation programmée",
  CANCELLED: "Résilié",
  EXPIRED: "Expiré",
};

export const FOLLOW_UP_LABELS: Record<string, string> = {
  CURRENT: "À jour",
  REMIND: "À relancer",
  ENDING: "Résiliation en cours",
  STOPPED: "Ne paie plus",
};

export const SUBSCRIPTION_KIND_LABELS: Record<string, string> = { COMMERCIAL: "Commercial", PILOT: "Pilote", LEGACY: "Historique" };

export const ROLE_LABELS_PLURAL: Record<SystemRole, string> = {
  COMPANY_ADMIN: "Administrateurs",
  MINI_ADMIN: "Mini-admins",
  DISPATCHER: "Dispatchers",
  DRIVER: "Livreurs",
  CLIENT: "Clients",
  SUPER_ADMIN: "Super admins",
};

export const ROLE_LABELS_SINGULAR: Record<SystemRole, string> = {
  COMPANY_ADMIN: "Administrateur",
  MINI_ADMIN: "Mini-admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Livreur",
  CLIENT: "Client",
  SUPER_ADMIN: "Super admin",
};

export const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
  PENDING_VERIFICATION: "En attente",
};

export const TICKET_STATUS_LABELS: Record<string, string> = { OPEN: "Ouvert", IN_PROGRESS: "En cours", RESOLVED: "Résolu", CLOSED: "Fermé" };
export const TICKET_PRIORITY_LABELS: Record<string, string> = { LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgente" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });
const euroFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const numberFormat = new Intl.NumberFormat("fr-FR");

export function text(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

export function formatDate(value: string | null | undefined) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

/** « novembre 2026 » : mois de la fiche (début du mois à Paris). */
export function formatMonth(value: string) {
  return monthFormat.format(new Date(value));
}

const utcDateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

/** Dernier jour inclus d'une période de consommation (mois UTC, borne de fin exclue). */
export function formatEndInclusive(endsAt: string | null) {
  return endsAt ? utcDateFormat.format(new Date(new Date(endsAt).getTime() - 1)) : "—";
}

export function euros(cents: number) {
  return euroFormat.format(cents / 100);
}

export function count(value: number) {
  return numberFormat.format(value);
}

export function plural(value: number, one: string, many: string) {
  return `${count(value)} ${value > 1 ? many : one}`;
}
