import type { DriverRoundView, DriverStopView } from "@/domains/round/round.types";
import { roundProgress } from "@/domains/round/round-rules";
import type { QueuedDriverAction } from "@/features/driver/offline-action-queue";

/** Arrêt affiché : état du serveur, plus les gestes encore dans la file hors réseau. */
export interface EffectiveStop extends DriverStopView {
  /** Geste fait sur le téléphone, pas encore reçu par le serveur. */
  pendingSync: boolean;
}

export interface EffectiveRound extends Omit<DriverRoundView, "stops"> {
  stops: EffectiveStop[];
  pendingSync: boolean;
}

/**
 * LIV-06 : l'écran reflète tout de suite « Démarrer », « Livré » et « Problème », même hors réseau, en
 * appliquant les actions en attente sur la dernière tournée reçue. Une action refusée par le serveur
 * (« failed ») n'est pas appliquée : elle est montrée à part. Fonction pure, testée.
 */
export function applyPendingActions(
  rounds: readonly DriverRoundView[],
  actions: readonly QueuedDriverAction[],
  /** Badge « en attente » : par défaut toute action ; l'écran ne le montre pas pendant un premier envoi en ligne. */
  showsPending: (action: QueuedDriverAction) => boolean = () => true
): EffectiveRound[] {
  const live = actions.filter((action) => action.state !== "failed");
  return rounds.map((round) => {
    const started = live.some((action) => action.payload.kind === "START" && action.payload.roundId === round.id);
    const stops: EffectiveStop[] = round.stops.map((stop) => {
      let next: EffectiveStop = { ...stop, pendingSync: false };
      for (const action of live) {
        const payload = action.payload;
        if (payload.kind === "START" || payload.stopId !== stop.id) continue;
        if (payload.kind === "DELIVERED" && next.status !== "DELIVERED") {
          next = { ...next, status: "DELIVERED", deliveredAt: payload.at, pendingSync: next.pendingSync || showsPending(action) };
        } else if (payload.kind === "INCIDENT") {
          next = {
            ...next,
            status: next.status === "DELIVERED" ? "DELIVERED" : "INCIDENT",
            incident: { code: payload.code, comment: payload.comment || null, at: payload.at, hasPhoto: Boolean(payload.photo) },
            pendingSync: next.pendingSync || showsPending(action),
          };
        }
      }
      return next;
    });
    const touched =
      started ||
      live.some((action) => action.payload.kind !== "START" && round.stops.some((stop) => action.payload.kind !== "START" && stop.id === action.payload.stopId));
    let status = round.status;
    if (status === "ASSIGNED" && touched) status = "IN_PROGRESS";
    if (status === "IN_PROGRESS" && stops.length > 0 && stops.every((stop) => stop.status !== "PENDING")) status = "COMPLETED";
    return { ...round, status, stops, progress: roundProgress(stops), pendingSync: stops.some((stop) => stop.pendingSync) };
  });
}
