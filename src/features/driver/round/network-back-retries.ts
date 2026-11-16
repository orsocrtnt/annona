/**
 * RECETTE-V1 N2 — envois rapprochés de la file livreur après le retour du réseau.
 *
 * Chaque minuterie se retire de la liste quand elle part, et un nouveau retour du réseau remplace les envois encore
 * en attente : un réseau qui va et vient n'empile pas les minuteries.
 */
export type NetworkBackRetries = {
  /** Programme un envoi à chaque délai, après avoir annulé ceux encore en attente. */
  schedule: () => void;
  /** Annule les envois en attente (démontage de l'écran). */
  cancel: () => void;
  /** Nombre d'envois encore en attente. */
  pending: () => number;
};

export function createNetworkBackRetries(run: () => void, delaysMs: readonly number[]): NetworkBackRetries {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cancel = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  return {
    schedule: () => {
      cancel();
      for (const delay of delaysMs) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          run();
        }, delay);
        timers.add(timer);
      }
    },
    cancel,
    pending: () => timers.size,
  };
}
