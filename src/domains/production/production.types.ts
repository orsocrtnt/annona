import type { OrderStatus } from "@prisma/client";

/** BOU-1 — espace boulanger (BOU-01 à BOU-06). */
export interface ProductionTotalProduct {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface ProductionTotalCategory {
  id: string;
  name: string;
  quantity: number;
  products: ProductionTotalProduct[];
}

export interface PreparationLine {
  lineId: string;
  productId: string;
  name: string;
  unit: string;
  categoryName: string;
  quantityOrdered: number;
  /** Vide tant que la commande n'est pas préparée ; plus petite que la commande en cas de manquant. */
  quantityDelivered: number | null;
}

export interface PreparationSheet {
  orderId: string;
  reference: string;
  status: OrderStatus;
  prepared: boolean;
  merchant: { name: string; address: string; postalCode: string | null; city: string | null; accessInstructions: string | null };
  slotLabel: string;
  round: { id: string; name: string } | null;
  stopSequence: number | null;
  /** Nombre d'arrêts de la tournée (« Arrêt 3/12 »). */
  stopCount: number | null;
  itemCount: number;
  shortage: boolean;
  lines: PreparationLine[];
}

export interface LoadingRound {
  id: string | null;
  name: string;
  slotLabel: string;
  /** Commandes dans l'ordre de chargement : dernier arrêt livré en premier (BOU-03). */
  orderIds: string[];
}

export interface ProductionDay {
  date: string;
  cutoffAt: string;
  /** Heure limite passée ou date verrouillée : totaux définitifs, bons et tournées disponibles. */
  closed: boolean;
  /** Total calculé sur des commandes encore modifiables (avant l'heure limite). */
  provisional: boolean;
  orderCount: number;
  itemCount: number;
  totals: ProductionTotalCategory[];
  sheets: PreparationSheet[];
  rounds: LoadingRound[];
}
