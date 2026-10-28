/** Données fictives de la mini-démo : aucune donnée réelle, aucun chiffre marketing. */
export const TOUR_ORDER = {
  number: "#1042",
  client: "Atelier Verde",
  pickup: "Entrepôt Ivry-sur-Seine",
  dropoff: "18 rue de la Roquette, Paris 11e",
  slot: "14 h – 16 h",
} as const;

export type TourDriver = {
  name: string;
  status: string;
  verdict: "chosen" | "rejected";
  reason: string;
};

/** Reflète les critères du dispatch automatique réel : disponibilité, zone, charge. */
export const TOUR_DRIVERS: readonly TourDriver[] = [
  { name: "Sofia", status: "En tournée", verdict: "rejected", reason: "Charge complète · 4/4" },
  { name: "Lucas", status: "Disponible", verdict: "rejected", reason: "Zone Paris Ouest" },
  { name: "Karim", status: "Disponible", verdict: "chosen", reason: "Zone « Paris Est »" },
];

export const TOUR_DISPATCH_REASON = "Zone « Paris Est »";
