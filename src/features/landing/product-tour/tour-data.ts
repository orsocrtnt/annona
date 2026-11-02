import type { TourStep } from "@/features/landing/product-tour/tour-machine";

/** Données fictives de la mini-démo : aucune donnée réelle, aucun chiffre marketing. */
export const TOUR_ORDER = {
  number: "#1042",
  client: "Atelier Verde",
  pickup: "Entrepôt Ivry-sur-Seine",
  dropoff: "18 rue de la Roquette, Paris 11e",
  slot: "14 h – 16 h",
} as const;

/** Livreurs de la démo : chacun a sa colonne, où le dispatcher dépose ses commandes. */
export const TOUR_LANES = [
  { driver: "Lucas", area: "Paris Est", detail: "À 1,1 km" },
  { driver: "Hugo", area: "Paris Nord", detail: "À 2,3 km" },
  { driver: "Sofia", area: "Paris Sud", detail: "À 0,9 km" },
] as const;

export type TourQueuedOrder = { number: string; place: string; driver: string; grouped?: boolean };

/** File d'attente avant le dispatch, dans l'ordre d'arrivée ; #1042 et #1043 sont voisines (11e). */
export const TOUR_QUEUE: readonly TourQueuedOrder[] = [
  { number: TOUR_ORDER.number, place: "Roquette, 11e", driver: "Lucas", grouped: true },
  { number: "#1044", place: "Batignolles, 17e", driver: "Hugo" },
  { number: "#1043", place: "Oberkampf, 11e", driver: "Lucas", grouped: true },
  { number: "#1045", place: "Alésia, 14e", driver: "Sofia" },
];

export const TOUR_PROOF = { recipient: "M. Durand", time: "14 h 21" } as const;

export const TOUR_INVOICE = { number: "F-2026-1042", amount: "38,00 €" } as const;

export type TourInterlude = {
  space: "company" | "driver" | "client";
  title: string;
  text: string;
  /** Durée d'affichage propre à ce carton, sinon la durée commune. */
  holdMs?: number;
};

const INTERLUDES: Partial<Record<`${TourStep}>${TourStep}`, TourInterlude>> = {
  "order>dispatch": { space: "company", title: "Pendant ce temps, côté entreprise…", text: "La commande arrive au dispatch" },
  "dispatch>driver": { space: "driver", title: "Côté livreur…", text: "Lucas reçoit la mission" },
  "driver>tracking": { space: "client", title: "Retour côté client…", text: "Il suit sa livraison en direct" },
  "tracking>proof": { space: "driver", title: "Côté livreur…", text: "Lucas arrive et prouve la livraison" },
  "proof>receipt": { space: "client", title: "Côté client…", text: "Livraison confirmée, facture reçue" },
  "receipt>invoices": { space: "company", title: "Côté entreprise…", text: "Les paiements se suivent tout seuls", holdMs: 3500 },
};

/** Carton affiché quand un geste fait passer d'un espace au suivant ; aucun en arrière ni sur place. */
export function interludeFor(from: TourStep, to: TourStep): TourInterlude | null {
  return INTERLUDES[`${from}>${to}`] ?? null;
}
