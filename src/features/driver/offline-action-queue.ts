import type { PodFailureCode } from "@/lib/pod/codes";

export type QueuedDriverStatus = "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED";

export type DriverPodPayload = {
  outcome: "SUCCESS" | "FAILED";
  photo: Blob | null;
  failureCode?: PodFailureCode;
  note?: string;
  /** Signature PNG (null si absente) : conservée dans IndexedDB avec la photo quand le livreur est hors ligne. */
  signature?: Blob | null;
  recipientName?: string;
  signatureRefusedReason?: string;
};

export type QueuedDriverActionPayload = {
  status: QueuedDriverStatus;
  purchaseItems?: { id: string; unitPrice: number }[];
  confirmOutOfRange?: boolean;
  latitude?: number;
  longitude?: number;
  pod?: DriverPodPayload;
};

export type QueuedDriverAction = {
  id: string;
  ownerId: string;
  missionId: string;
  payload: QueuedDriverActionPayload;
  state: "pending" | "sending" | "failed";
  attempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  lastError: string | null;
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

const DB_NAME = "annona-driver-actions";
const DB_VERSION = 1;
const STORE_NAME = "mission-status";
const RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000, 300_000] as const;
/**
 * Durée maximale de conservation d'une action sur l'appareil (LEGAL-1, minimisation) : photo, signature,
 * nom du destinataire et position ne restent pas indéfiniment dans le navigateur. Au-delà, l'action est
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
    store.createIndex("ownerMission", ["ownerId", "missionId"], { unique: true });
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
  missionId: string;
  payload: QueuedDriverActionPayload;
  now?: number;
}): QueuedDriverAction {
  const now = input.now ?? Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    ownerId: input.ownerId,
    missionId: input.missionId,
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
    (candidate) => candidate.missionId === action.missionId
  );
  if (existing) throw new Error("MISSION_ACTION_ALREADY_QUEUED");
  try {
    await store.add(action);
  } catch (error) {
    if (error instanceof DOMException && error.name === "ConstraintError") {
      throw new Error("MISSION_ACTION_ALREADY_QUEUED");
    }
    throw error;
  }
}

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)]!;
}

export async function processQueuedDriverActions(options: {
  store: DriverActionQueueStore;
  ownerId: string;
  send: (action: QueuedDriverAction) => Promise<unknown>;
  force?: boolean;
  now?: () => number;
}): Promise<DriverActionQueueRun> {
  const result: DriverActionQueueRun = { sent: [], waiting: [], failed: [] };
  const now = options.now ?? Date.now;
  const actions = await options.store.list(options.ownerId);

  for (const action of actions) {
    if (action.state === "failed" && !options.force) {
      result.failed.push(action.id);
      continue;
    }
    if (!options.force && action.nextAttemptAt > now()) {
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
      await options.store.delete(sending.id);
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
  if (action.state === "failed" || action.attempts > 0 || action.lastError) return true;
  return !online;
}
