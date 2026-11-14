/**
 * File d'actions hors réseau de l'application livreur (LIV-06, critère de recette 8).
 *
 * Chaque geste (« Démarrer », « Livré », « Problème ») est d'abord écrit dans IndexedDB, puis envoyé ;
 * sans réseau il reste sur le téléphone, photo comprise, et part au retour de la connexion. Le serveur
 * est idempotent : un envoi rejoué ne crée pas de doublon. `actionKey` (ex. `stop:<id>:delivered`)
 * interdit deux actions identiques en attente pour le même compte.
 *
 * RECETTE-V1 N1 : une action reçue par le serveur n'est pas effacée tout de suite. Elle passe à l'état
 * « sent » et reste appliquée à l'écran jusqu'à une lecture fraîche de la tournée (réponse du serveur, pas
 * la copie du service worker) commencée après l'envoi. Sans cela, une coupure juste après l'envoi faisait
 * réapparaître l'arrêt « en cours » à partir d'une copie plus ancienne.
 */
export type QueuedDriverActionPayload =
  | { kind: "START"; roundId: string; at: string }
  | { kind: "DELIVERED"; stopId: string; at: string }
  | { kind: "INCIDENT"; stopId: string; at: string; code: string; comment: string; photo: Blob | null };

export type QueuedDriverAction = {
  id: string;
  ownerId: string;
  actionKey: string;
  payload: QueuedDriverActionPayload;
  /** « sent » : reçue par le serveur, gardée à l'écran jusqu'à une lecture fraîche (RECETTE-V1 N1). */
  state: "pending" | "sending" | "failed" | "sent";
  attempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  lastError: string | null;
  /** Heure de la réponse du serveur à l'envoi (état « sent »). */
  sentAt?: number;
};

export type DriverActionQueueStore = {
  add(action: QueuedDriverAction): Promise<void>;
  put(action: QueuedDriverAction): Promise<void>;
  delete(id: string): Promise<void>;
  list(ownerId: string): Promise<QueuedDriverAction[]>;
  /** Toutes les actions de l'appareil, tous comptes confondus (purge des actions expirées). */
  listAll(): Promise<QueuedDriverAction[]>;
};

export type DriverActionSendError = Error & {
  retryable?: boolean;
};

export type DriverActionQueueRun = {
  sent: string[];
  waiting: string[];
  failed: string[];
};

const DB_NAME = "annona-driver-stop-actions";
const DB_VERSION = 1;
const STORE_NAME = "stop-actions";
const RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000, 300_000] as const;
/**
 * Durée maximale de conservation d'une action sur l'appareil (LEGAL-1, minimisation) : une photo
 * d'incident ne reste pas indéfiniment dans le navigateur. Au-delà, l'action est
 * supprimée, quel que soit le compte qui l'a créée. Valeur provisoire tant que le propriétaire n'a pas
 * arrêté les durées de conservation (docs/legal/VERIFICATION_2026-11-02.md, section 4).
 */
export const DRIVER_ACTION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("STORAGE_ERROR"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("STORAGE_ERROR"));
    transaction.onabort = () => reject(transaction.error ?? new Error("STORAGE_ABORTED"));
  });
}

async function openQueueDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("OFFLINE_STORAGE_UNAVAILABLE");
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (database.objectStoreNames.contains(STORE_NAME)) return;
    const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("ownerId", "ownerId", { unique: false });
    store.createIndex("ownerAction", ["ownerId", "actionKey"], { unique: true });
  };
  return requestResult(request);
}

export const browserDriverActionQueueStore: DriverActionQueueStore = {
  async add(action) {
    const database = await openQueueDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).add(action);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async put(action) {
    const database = await openQueueDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(action);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async delete(id) {
    const database = await openQueueDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async list(ownerId) {
    const database = await openQueueDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const index = transaction.objectStore(STORE_NAME).index("ownerId");
      const actions = await requestResult(index.getAll(IDBKeyRange.only(ownerId)));
      await transactionDone(transaction);
      return (actions as QueuedDriverAction[]).sort((left, right) => left.createdAt - right.createdAt);
    } finally {
      database.close();
    }
  },
  async listAll() {
    const database = await openQueueDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const actions = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      await transactionDone(transaction);
      return actions as QueuedDriverAction[];
    } finally {
      database.close();
    }
  },
};

/**
 * Supprime de l'appareil les actions créées depuis plus de `maxAgeMs`, tous comptes confondus : celles d'un
 * livreur qui ne se reconnecte plus sur ce téléphone ne restent pas indéfiniment. Une action en cours
 * d'envoi n'est pas touchée. Renvoie les identifiants supprimés.
 */
export async function purgeExpiredDriverActions(
  store: DriverActionQueueStore,
  options: { now?: number; maxAgeMs?: number } = {}
): Promise<string[]> {
  const cutoff = (options.now ?? Date.now()) - (options.maxAgeMs ?? DRIVER_ACTION_MAX_AGE_MS);
  const expired = (await store.listAll()).filter(
    (action) => action.state !== "sending" && action.createdAt < cutoff
  );
  for (const action of expired) await store.delete(action.id);
  return expired.map((action) => action.id);
}

export function createQueuedDriverAction(input: {
  id?: string;
  ownerId: string;
  actionKey: string;
  payload: QueuedDriverActionPayload;
  now?: number;
}): QueuedDriverAction {
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    ownerId: input.ownerId,
    actionKey: input.actionKey,
    payload: input.payload,
    state: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    lastError: null,
  };
}

export async function enqueueDriverAction(
  store: DriverActionQueueStore,
  action: QueuedDriverAction
): Promise<void> {
  const existing = (await store.list(action.ownerId)).find(
    (candidate) => candidate.actionKey === action.actionKey
  );
  if (existing) throw new Error("DRIVER_ACTION_ALREADY_QUEUED");
  try {
    await store.add(action);
  } catch (error) {
    if (error instanceof DOMException && error.name === "ConstraintError") {
      throw new Error("DRIVER_ACTION_ALREADY_QUEUED");
    }
    throw error;
  }
}

/**
 * Action reçue par le serveur : gardée à l'écran (état « sent ») jusqu'à une lecture fraîche. La photo
 * d'un problème n'est plus gardée sur le téléphone (LEGAL-1) ; un marqueur vide garde « photo jointe »
 * à l'écran en attendant.
 */
function markSent(action: QueuedDriverAction, at: number): QueuedDriverAction {
  const payload =
    action.payload.kind === "INCIDENT" && action.payload.photo
      ? { ...action.payload, photo: new Blob([], { type: action.payload.photo.type }) }
      : action.payload;
  return { ...action, payload, state: "sent", sentAt: at, updatedAt: at, lastError: null };
}

/**
 * RECETTE-V1 N1 : retire les actions « sent » qu'une lecture fraîche de la tournée reflète déjà, c'est-à-dire
 * une lecture du serveur (pas une copie du service worker) commencée à `freshSince` ou après l'envoi. À
 * partir de là, l'écran suit le serveur, même si celui-ci dit autre chose (arrêt remis en attente par
 * l'administrateur). Renvoie les identifiants retirés.
 */
export async function settleSentDriverActions(
  store: DriverActionQueueStore,
  ownerId: string,
  freshSince: number
): Promise<string[]> {
  const settled = (await store.list(ownerId)).filter(
    (action) => action.state === "sent" && (action.sentAt ?? action.updatedAt) <= freshSince
  );
  for (const action of settled) await store.delete(action.id);
  return settled.map((action) => action.id);
}

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)]!;
}

export async function processQueuedDriverActions(options: {
  store: DriverActionQueueStore;
  ownerId: string;
  send: (action: QueuedDriverAction) => Promise<unknown>;
  force?: boolean;
  /**
   * RECETTE-V1 N2 : réseau revenu (ou application revenue au premier plan) : les actions en attente partent
   * tout de suite, sans attendre le délai de nouvelle tentative pris hors réseau. Contrairement à `force`, les
   * actions refusées par le serveur ne sont pas renvoyées (réservé au bouton « Réessayer maintenant »).
   */
  ignoreBackoff?: boolean;
  now?: () => number;
}): Promise<DriverActionQueueRun> {
  const result: DriverActionQueueRun = { sent: [], waiting: [], failed: [] };
  const now = options.now ?? Date.now;
  const actions = await options.store.list(options.ownerId);

  for (const action of actions) {
    if (action.state === "sent") continue;
    if (action.state === "failed" && !options.force) {
      result.failed.push(action.id);
      continue;
    }
    if (!options.force && !options.ignoreBackoff && action.nextAttemptAt > now()) {
      result.waiting.push(action.id);
      continue;
    }

    const sending: QueuedDriverAction = {
      ...action,
      state: "sending",
      updatedAt: now(),
    };
    await options.store.put(sending);

    try {
      await options.send(sending);
      await options.store.put(markSent(sending, now()));
      result.sent.push(sending.id);
    } catch (error) {
      const typed = error as DriverActionSendError;
      const attempts = sending.attempts + 1;
      const retryable = typed?.retryable !== false;
      const failed: QueuedDriverAction = {
        ...sending,
        state: retryable ? "pending" : "failed",
        attempts,
        updatedAt: now(),
        nextAttemptAt: now() + retryDelay(attempts),
        lastError: error instanceof Error ? error.message : "Synchronisation impossible.",
      };
      await options.store.put(failed);
      (retryable ? result.waiting : result.failed).push(failed.id);
    }
  }

  return result;
}

/**
 * Une action tout juste mise en file et en cours de premier envoi (en ligne, aucune tentative échouée)
 * n'est ni « en attente » ni en erreur : l'afficher ferait apparaître « Réessayer maintenant » alors que
 * la requête réussit. Seules les actions refusées, déjà tentées ou hors ligne méritent la bannière.
 */
export function actionNeedsAttention(action: QueuedDriverAction, online: boolean): boolean {
  if (action.state === "sent") return false;
  if (action.state === "failed" || action.attempts > 0 || action.lastError) return true;
  return !online;
}
