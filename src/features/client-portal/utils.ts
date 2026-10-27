import { relativeDayLabel } from "@/lib/format/relative-day";

export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatEta(date: string | null): string {
  if (!date) return "—";
  // Fuseau explicite : même heure au rendu serveur et dans le navigateur.
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Jour de l'arrivée estimée, à associer à l'heure : « aujourd'hui », « demain », « le 29 oct. ». */
export function etaDayLabel(date: string | null, now = new Date()): string {
  if (!date) return "Aucune livraison prévue";
  const label = relativeDayLabel(date, now);
  if (label === "Aujourd'hui" || label === "Hier" || label === "Demain") return label.toLowerCase();
  return `le ${label}`;
}

/** « Facture d'aujourd'hui », « Facture d'hier », « Facture du 27 oct. ». */
export function invoiceTitle(createdAt: string, now = new Date()): string {
  const label = relativeDayLabel(createdAt, now);
  if (label === "Aujourd'hui") return "Facture d'aujourd'hui";
  if (label === "Hier") return "Facture d'hier";
  return `Facture du ${label}`;
}
