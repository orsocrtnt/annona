import { after } from "next/server";

type AfterResponseOptions = {
  /** Planificateur injectable (tests) ; par défaut `after()` de Next.js. */
  schedule?: (task: () => Promise<unknown>) => void;
  log?: (...args: unknown[]) => void;
};

const OUTSIDE_REQUEST_SCOPE = /outside a request scope/i;

/**
 * Exécute un effet différé après l'envoi de la réponse HTTP. Sur Vercel,
 * `after()` garde la fonction vivante (waitUntil) ; un simple `void promise`
 * peut être gelé avant la fin et laisser la tâche en PENDING.
 * Hors contexte de requête (tests, scripts), `after()` lève l'erreur « outside
 * a request scope » : seule celle-ci déclenche l'exécution directe, journalisée.
 * Toute autre erreur du planificateur est journalisée sans lancer la tâche (le
 * filet cron la reprendra). L'appelant ne reçoit jamais d'exception.
 */
export function runAfterResponse(
  task: () => Promise<unknown>,
  options: AfterResponseOptions = {}
) {
  const log = options.log ?? ((...args: unknown[]) => console.error(...args));
  const safeTask = async () => {
    try {
      await task();
    } catch (error) {
      log("[after-response]", error instanceof Error ? error.message : "Erreur inconnue");
    }
  };
  try {
    (options.schedule ?? after)(safeTask);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    if (OUTSIDE_REQUEST_SCOPE.test(message)) {
      log("[after-response] repli : exécution directe hors contexte de requête");
      void safeTask();
    } else {
      log("[after-response] planification impossible", message);
    }
  }
}
