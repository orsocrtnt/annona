import type { OrderOrigin, OrderStatus, RoundStatus } from "@prisma/client";

/** LOCK-1 — vues du back-office commandes (ADM-04, ADM-05). Montants en centimes HT. */
export interface AdminOrderRow {
  id: string;
  reference: string;
  merchant: { id: string; name: string };
  slot: { id: string; label: string; startTime: string };
  status: OrderStatus;
  origin: OrderOrigin;
  round: { id: string; name: string } | null;
  stopSequence: number | null;
  lineCount: number;
  itemCount: number;
  subtotalCents: number;
  /** Une ligne au moins livrée en quantité réduite (BOU-06). */
  shortage: boolean;
  /** Corrigée par un administrateur (RG-10). */
  corrected: boolean;
}

export interface AdminOrderDay {
  date: string;
  cutoffAt: string;
  closed: boolean;
  lockedAt: string | null;
  merchants: Array<{ id: string; name: string }>;
  rounds: Array<{ id: string; name: string; status: RoundStatus; driverName: string | null }>;
  orders: AdminOrderRow[];
  /** Commandes du jour avant filtres. */
  total: number;
}

export interface AdminOrderLine {
  id: string;
  productId: string;
  name: string;
  unit: string;
  quantityOrdered: number;
  quantityDelivered: number | null;
  unitPriceCents: number;
  frozen: boolean;
  vatRateBasisPoints: number;
}

export interface AdminOrderHistoryEntry {
  id: string;
  at: string;
  actorName: string;
  action: string;
  afterCutoff: boolean;
  changes: string[];
}

export interface AdminOrderDetail {
  id: string;
  reference: string;
  deliveryDate: string;
  cutoffAt: string;
  afterCutoff: boolean;
  status: OrderStatus;
  origin: OrderOrigin;
  notes: string | null;
  editable: boolean;
  /** FACT-1 : facture de période qui regroupe la commande (elle ne se corrige plus). */
  invoice: { id: string; reference: string } | null;
  merchant: { id: string; name: string; address: string; city: string | null };
  slot: { id: string; label: string };
  round: { id: string; name: string; status: RoundStatus; driverName: string | null } | null;
  stopSequence: number | null;
  lockedAt: string | null;
  preparedAt: string | null;
  lines: AdminOrderLine[];
  subtotalCents: number;
  deliveredSubtotalCents: number;
  history: AdminOrderHistoryEntry[];
}
