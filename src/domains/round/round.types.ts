import type { OrderStatus, RoundStatus, StopStatus } from "@prisma/client";
import type { StopIncidentCode } from "@/domains/round/round-rules";

/** TOUR-1 — vues des tournées : back-office (ADM-06 à ADM-08) et application livreur (LIV-01 à LIV-05). */

export interface StopIncidentView {
  code: StopIncidentCode | string;
  comment: string | null;
  at: string;
  hasPhoto: boolean;
}

export interface RoundStopView {
  id: string;
  sequence: number;
  status: StopStatus;
  orderId: string;
  orderReference: string;
  orderStatus: OrderStatus;
  merchantName: string;
  /** Adresse complète sur une ligne. */
  address: string;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string | null;
  /** Un colis par ligne de commande (voir `stopPackages`). */
  packages: number;
  items: number;
  estimatedArrivalAt: string | null;
  deliveredAt: string | null;
  incident: StopIncidentView | null;
}

export interface AdminRoundView {
  id: string;
  name: string;
  slotId: string;
  slotLabel: string;
  status: RoundStatus;
  driverId: string | null;
  driverName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  progress: { total: number; delivered: number; incidents: number; remaining: number };
  stops: RoundStopView[];
}

export interface RoundJournalEntry {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  roundName: string | null;
  details: string[];
  afterCutoff: boolean;
}

export interface AdminRoundsDay {
  date: string;
  cutoffAt: string;
  closed: boolean;
  depot: { latitude: number; longitude: number } | null;
  slots: Array<{ id: string; label: string; startTime: string }>;
  rounds: AdminRoundView[];
  drivers: Array<{ id: string; name: string }>;
  /** Commandes verrouillées sans arrêt (aucune tournée) : ne devrait pas arriver après le verrouillage. */
  unroutedOrders: number;
  journal: RoundJournalEntry[];
}

export interface ValidateRoundsResult {
  validated: number;
  withoutDriver: string[];
  empty: string[];
}

// ---------------------------------------------------------------------------
// Livreur
// ---------------------------------------------------------------------------

export interface DriverStopView extends Omit<RoundStopView, "orderStatus" | "estimatedArrivalAt"> {
  contactPhone: string | null;
  lines: Array<{ name: string; unit: string; quantity: number }>;
}

export interface DriverRoundView {
  id: string;
  name: string;
  date: string;
  slotLabel: string;
  status: RoundStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** Démarrage permis seulement le jour de la tournée (ou après, si elle n'a pas été démarrée). */
  canStart: boolean;
  progress: { total: number; delivered: number; incidents: number; remaining: number };
  stops: DriverStopView[];
}

export interface DriverRoundsData {
  today: string;
  /** Jour affiché : aujourd'hui s'il y a une tournée, sinon la prochaine tournée validée. */
  date: string | null;
  rounds: DriverRoundView[];
}

// ---------------------------------------------------------------------------
// Suivi en direct (ADM-08)
// ---------------------------------------------------------------------------

export interface LiveRound {
  id: string;
  name: string;
  slotLabel: string;
  status: RoundStatus;
  driverName: string | null;
  progress: { total: number; delivered: number; incidents: number; remaining: number };
  startedAt: string | null;
  completedAt: string | null;
  lastDeliveredAt: string | null;
  nextStopName: string | null;
  /** Position du livreur, seulement pendant la tournée démarrée (ENF-04). */
  driverPosition: { latitude: number; longitude: number; updatedAt: string } | null;
  stops: Array<{ id: string; sequence: number; status: StopStatus; merchantName: string; latitude: number | null; longitude: number | null }>;
}

export interface LiveIncident {
  stopId: string;
  roundName: string;
  driverName: string | null;
  merchantName: string;
  code: string;
  comment: string | null;
  at: string;
  hasPhoto: boolean;
  stopStatus: StopStatus;
}

export interface LiveDashboard {
  date: string;
  generatedAt: string;
  orders: { total: number; byStatus: Partial<Record<OrderStatus, number>> };
  totals: { rounds: number; inProgress: number; completed: number; stops: number; delivered: number; incidents: number; remaining: number };
  rounds: LiveRound[];
  incidents: LiveIncident[];
  depot: { latitude: number; longitude: number } | null;
}
