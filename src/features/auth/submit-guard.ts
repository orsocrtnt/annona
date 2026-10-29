/**
 * Garde d'envoi unique (connexion) : un seul envoi à la fois. Un délai de sécurité rouvre la garde si la requête
 * ne répond jamais ; après un succès, `hold()` la garde fermée jusqu'à `release()` (retour arrière depuis le bfcache).
 */
export type SubmitGuard = {
  /** Vrai si l'envoi peut partir (et ferme la garde), faux si un envoi est déjà en cours. */
  tryAcquire(): boolean;
  /** Succès : la navigation est en cours, la garde reste fermée sans délai. */
  hold(): void;
  /** Échec, réponse illisible ou page restaurée : la garde se rouvre. */
  release(): void;
  isLocked(): boolean;
};

type Scheduler = {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

const defaultScheduler: Scheduler = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSubmitGuard({
  timeoutMs = 30_000,
  scheduler = defaultScheduler,
}: { timeoutMs?: number; scheduler?: Scheduler } = {}): SubmitGuard {
  let locked = false;
  let timer: unknown = null;
  const clearTimer = () => {
    if (timer !== null) scheduler.clear(timer);
    timer = null;
  };
  return {
    tryAcquire() {
      if (locked) return false;
      locked = true;
      clearTimer();
      timer = scheduler.set(() => {
        timer = null;
        locked = false;
      }, timeoutMs);
      return true;
    },
    hold() {
      clearTimer();
      locked = true;
    },
    release() {
      clearTimer();
      locked = false;
    },
    isLocked: () => locked,
  };
}
