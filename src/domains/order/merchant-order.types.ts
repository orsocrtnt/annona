import type { OrderOrigin, OrderStatus } from "@prisma/client";

/** Données du portail client (CMD-1), partagées entre l'API et l'interface. */

export interface PortalSlot {
  id: string;
  /** « Matin » ou « Soir » pour une tournée (lot 1, demande 1) ; jamais d'heure montrée au client. */
  label: string;
  startTime: string;
  endTime: string;
  period?: "MORNING" | "EVENING" | null;
}

export interface PortalProduct {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  photoVersion: string | null;
  /** Prix appliqué HT (RG-05). */
  unitPriceCents: number;
  vatRateBasisPoints: number;
  isSpecific: boolean;
  /** Lot 1, demande 3 : null = « Allergènes non renseignés » ; [] = « Aucun allergène ». */
  allergens: string[] | null;
}

export interface PortalCategory {
  id: string;
  name: string;
  products: PortalProduct[];
}

export interface OrderingRules {
  /** Aujourd'hui dans le fuseau de l'entreprise. */
  today: string;
  /** Première date encore ouverte (RG-01, RG-02). */
  firstOpenDate: string;
  cutoffTime: string;
  timeZone: string;
}

export interface PortalCatalog {
  categories: PortalCategory[];
  slots: PortalSlot[];
  rules: OrderingRules;
}

export interface PortalOrderLine {
  productId: string;
  name: string;
  unit: string;
  photoVersion: string | null;
  quantity: number;
  quantityDelivered: number | null;
  /** Prix figé au verrouillage s'il existe, sinon prix appliqué actuel. */
  unitPriceCents: number;
  /** Prix appliqué aujourd'hui (recopie, CLI-08). */
  currentUnitPriceCents: number;
  vatRateBasisPoints: number;
  /** Produit encore proposé (actif, catégorie active). */
  available: boolean;
}

export interface PortalOrderSummary {
  id: string;
  reference: string;
  deliveryDate: string;
  slot: PortalSlot;
  status: OrderStatus;
  origin: OrderOrigin;
  lineCount: number;
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
  /** CLI-06 : modifiable et annulable maintenant. */
  editable: boolean;
  /** Heure limite (ISO). */
  cutoffAt: string;
}

export interface PortalOrderDetail extends PortalOrderSummary {
  vatCents: number;
  notes: string | null;
  lines: PortalOrderLine[];
}

export interface PortalOrderList {
  orders: PortalOrderSummary[];
  /** Pagination de l'historique : date à passer en `before` pour la suite. */
  nextBefore: string | null;
}

export interface PortalRecurringOrder {
  id: string;
  label: string | null;
  slot: PortalSlot;
  weekdays: number[];
  active: boolean;
  lines: Array<{ productId: string; name: string; unit: string; quantity: number; unitPriceCents: number; available: boolean }>;
  subtotalCents: number;
}

export interface PortalMerchantProfile {
  name: string;
  tradeName: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
  accessInstructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  billingPeriod: string;
  paymentMethod: string | null;
  siren: string | null;
  vatNumber: string | null;
}
