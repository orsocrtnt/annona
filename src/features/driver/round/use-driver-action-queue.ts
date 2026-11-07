"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { driverRoundApi } from "@/features/driver/round/driver-round-api";
import {
  browserDriverActionQueueStore,
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  purgeExpiredDriverActions,
  settleSentDriverActions,
  type QueuedDriverAction,
  type QueuedDriverActionPayload,
} from "@/features/driver/offline-action-queue";
import { watchConnectivity } from "@/lib/native/network";

const RETRY_INTERVAL_MS = 15_000;

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * LIV-06 — file hors réseau branchée sur l'application livreur. Chaque geste est écrit dans IndexedDB
 * puis envoyé ; hors réseau il attend, et part au retour de la connexion (événement `online`, puis toutes
 * les 15 s). Quand au moins une action est arrivée au serveur, `onSynced` relance la lecture de la tournée.
 * Les actions reçues restent appliquées à l'écran (état « sent ») jusqu'à ce que l'écran appelle `settle`
 * avec l'heure d'une lecture fraîche (RECETTE-V1 N1) : une copie hors réseau ne les efface jamais.
 */
export function useDriverActionQueue(ownerId: string | null, onSynced: () => Promise<unknown>) {
  const [actions, setActions] = useState<QueuedDriverAction[]>([]);
  const [online, setOnline] = useState(isOnline);
  const [storageError, setStorageError] = useState(false);
  const running = useRef(false);
  const again = useRef(false);
  const syncedRef = useRef(onSynced);
  useEffect(() => {
    syncedRef.current = onSynced;
  }, [onSynced]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      setActions(await browserDriverActionQueueStore.list(ownerId));
    } catch {
      setStorageError(true);
    }
  }, [ownerId]);

  const process = useCallback(
    async (force = false) => {
      if (!ownerId) return;
      if (!isOnline() && !force) return;
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      try {
        do {
          again.current = false;
          const result = await processQueuedDriverActions({ store: browserDriverActionQueueStore, ownerId, send: driverRoundApi.send, force });
          // Les gestes reçus restent affichés (« sent ») ; la relecture fraîche les retirera (`settle`). Elle
          // n'est pas attendue : une relecture qui traîne (RECETTE-V1 N1) ne bloque plus la file.
          if (result.sent.length > 0) void syncedRef.current().catch(() => undefined);
          await refresh();
        } while (again.current && isOnline());
      } catch {
        setStorageError(true);
      } finally {
        running.current = false;
      }
    },
    [ownerId, refresh]
  );

  const enqueue = useCallback(
    async (actionKey: string, payload: QueuedDriverActionPayload) => {
      if (!ownerId) return;
      try {
        await enqueueDriverAction(browserDriverActionQueueStore, createQueuedDriverAction({ ownerId, actionKey, payload }));
      } catch (error) {
        // Le même geste déjà en attente : rien de plus à faire, il partira avec la file.
        if (!(error instanceof Error && error.message === "DRIVER_ACTION_ALREADY_QUEUED")) {
          setStorageError(true);
          throw error;
        }
      }
      await refresh();
      void process();
    },
    [ownerId, process, refresh]
  );

  /** Lecture fraîche de la tournée commencée à `freshAt` : les actions reçues avant sont retirées. */
  const settle = useCallback(
    async (freshAt: number) => {
      if (!ownerId) return;
      try {
        const settled = await settleSentDriverActions(browserDriverActionQueueStore, ownerId, freshAt);
        if (settled.length > 0) await refresh();
      } catch {
        setStorageError(true);
      }
    },
    [ownerId, refresh]
  );

  const discard = useCallback(
    async (id: string) => {
      await browserDriverActionQueueStore.delete(id);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    if (!ownerId) return;
    void purgeExpiredDriverActions(browserDriverActionQueueStore)
      .catch(() => undefined)
      .finally(() => {
        void refresh().then(() => process());
      });
    // MOBILE-1 : réseau natif et retour au premier plan dans l'application ; `online`/`offline` sinon.
    const stopConnectivity = watchConnectivity({
      onOnline: () => {
        setOnline(true);
        void process();
      },
      onOffline: () => setOnline(false),
      onResume: () => {
        setOnline(isOnline());
        void process();
      },
    });
    const timer = window.setInterval(() => void process(), RETRY_INTERVAL_MS);
    return () => {
      stopConnectivity();
      window.clearInterval(timer);
    };
  }, [ownerId, process, refresh]);

  return {
    actions,
    online,
    storageError,
    enqueue,
    discard,
    settle,
    retry: () => process(true),
  };
}
