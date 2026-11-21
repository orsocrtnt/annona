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
  /** Lot 2, demandes 9 et 10 : gros gâteau, taille (parts) et inscription à écrire ; vide sinon. */
  detail?: string | null;
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

/**
 * RETOURS-1 (tour de Théo, 21 novembre) : pour le pâtissier, chaque produit du total s'ouvre sur « pour qui » :
 * client ou boutique, particulier d'une commande de gâteau, taille, inscription et instructions de la commande.
 */
export interface ProductionRecipient {
  lineId: string;
  /** Restaurant (client) ou boutique qui reçoit. */
  merchantName: string;
  /** Commande de gâteau d'un particulier passée en boutique : son nom, son téléphone et l'heure de retrait. */
  customer: { name: string; phone: string; pickupAt: string } | null;
  quantity: number;
  servings: number | null;
  inscription: string | null;
  /** Instructions laissées sur la commande (champ « notes »). */
  notes: string | null;
}

export interface ProductionProductDetail {
  /** Libellés des allergènes déclarés du produit ; `null` si non déclarés. */
  allergens: string[] | null;
  recipients: ProductionRecipient[];
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
  /** Pâtissier seulement (RETOURS-1) : détail « pour qui » de chaque produit du total, par `productId`. */
  details?: Record<string, ProductionProductDetail>;
}
