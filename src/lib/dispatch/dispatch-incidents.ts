import { isWholeDayDue } from "@/lib/orders/whole-day-due";

/** Fenêtre d'alerte d'une commande sans livreur à l'échéance proche (« commande urgente »). */
export const DUE_SOON_MINUTES = 60;
/** Livreur hors service : l'alerte n'a de sens que si sa mission approche. */
export const OFF_DUTY_ALERT_MINUTES = 120;

export type DispatchIncidentKind = "DRIVER_UNAVAILABLE" | "DRIVER_OFF_DUTY" | "LATE" | "DUE_SOON_UNASSIGNED";

export type DispatchIncidentInput = {
  id: string;
  reference: string;
  status: string;
  driverId: string | null;
  driverName: string | null;
  driverActive: boolean;
  driverOnDuty: boolean;
  missionStarted: boolean;
  deadline: Date | null;
};

export type DispatchIncident = {
  deliveryId: string;
  reference: string;
  kind: DispatchIncidentKind;
  title: string;
  detail: string;
  deadline: string | null;
};

const ACTIVE = new Set(["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"]);
const PRIORITY: Record<DispatchIncidentKind, number> = {
  DRIVER_UNAVAILABLE: 0,
  DRIVER_OFF_DUTY: 1,
  LATE: 2,
  DUE_SOON_UNASSIGNED: 3,
};

function classify(row: DispatchIncidentInput, now: Date): Pick<DispatchIncident, "kind" | "title" | "detail"> | null {
  const minutesLeft = row.deadline ? (row.deadline.getTime() - now.getTime()) / 60_000 : null;
  const late = minutesLeft !== null && minutesLeft < 0;
  // Commande « au jour » : aucune heure n'est promise, seul le dépassement de la journée compte.
  const hourPromised = Boolean(row.deadline) && !isWholeDayDue(row.deadline);
  const waiting = row.status === "PENDING" && !row.driverId;
  const assigned = row.status === "ASSIGNED" && Boolean(row.driverId) && !row.missionStarted;
  const driver = row.driverName || "Le livreur";

  if (assigned && !row.driverActive) {
    return { kind: "DRIVER_UNAVAILABLE", title: "Livreur indisponible", detail: `${driver} n’a plus de compte actif. Confiez la mission à un autre livreur.` };
  }
  if (assigned && !row.driverOnDuty && (late || (hourPromised && minutesLeft !== null && minutesLeft <= OFF_DUTY_ALERT_MINUTES))) {
    return { kind: "DRIVER_OFF_DUTY", title: "Livreur hors service", detail: `${driver} n’a pas démarré son service et l’échéance approche.` };
  }
  if (late) {
    return {
      kind: "LATE",
      title: "En retard",
      detail: waiting ? "L’échéance est dépassée et aucun livreur n’est affecté."
        : assigned ? `${driver} n’a pas démarré cette mission et l’échéance est dépassée.`
        : `${driver} est en cours de mission et l’échéance est dépassée.`,
    };
  }
  if (waiting && hourPromised && minutesLeft !== null && minutesLeft <= DUE_SOON_MINUTES) {
    return { kind: "DUE_SOON_UNASSIGNED", title: "Urgent, sans livreur", detail: `Échéance dans moins de ${DUE_SOON_MINUTES} minutes et aucun livreur n’est affecté.` };
  }
  return null;
}

/** Fonction pure : aucune coordonnée en entrée ni en sortie, le livreur n'est décrit que par son nom. */
export function computeDispatchIncidents(rows: DispatchIncidentInput[], now = new Date()): DispatchIncident[] {
  const incidents: DispatchIncident[] = [];
  for (const row of rows) {
    if (!ACTIVE.has(row.status)) continue;
    const found = classify(row, now);
    if (!found) continue;
    incidents.push({
      ...found,
      deliveryId: row.id,
      reference: row.reference,
      deadline: row.deadline ? row.deadline.toISOString() : null,
    });
  }
  return incidents.sort((a, b) =>
    PRIORITY[a.kind] - PRIORITY[b.kind]
    || (a.deadline ?? "9").localeCompare(b.deadline ?? "9")
    || a.reference.localeCompare(b.reference));
}
