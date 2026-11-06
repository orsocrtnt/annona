import type { SystemRole } from "@prisma/client";

/** Libellés et formats de la fiche entreprise (ADMIN-ESPACE lot 3). Dates et heures à Paris. */

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspendue",
  TRIAL: "Essai",
};

export const ROLE_LABELS_PLURAL: Record<SystemRole, string> = {
  ADMIN: "Administrateurs",
  BAKER: "Boulangers",
  DRIVER: "Livreurs",
  MERCHANT: "Clients",
  SUPER_ADMIN: "Super admins",
};

export const ROLE_LABELS_SINGULAR: Record<SystemRole, string> = {
  ADMIN: "Administrateur",
  BAKER: "Boulanger",
  DRIVER: "Livreur",
  MERCHANT: "Client",
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


export function euros(cents: number) {
  return euroFormat.format(cents / 100);
}

export function count(value: number) {
  return numberFormat.format(value);
}

export function plural(value: number, one: string, many: string) {
  return `${count(value)} ${value > 1 ? many : one}`;
}
