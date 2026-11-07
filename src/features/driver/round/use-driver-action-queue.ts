"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { driverRoundApi } from "@/features/driver/round/driver-round-api";
import {
  browserDriverActionQueueStore,
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  purgeExpiredDriverActions,
  type QueuedDriverAction,
  type QueuedDriverActionPayload,
} from "@/features/driver/offline-action-queue";

const RETRY_INTERVAL_MS = 15_000;

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * LIV-06 — file hors réseau branchée sur l'application livreur. Chaque geste est écrit dans IndexedDB
 * puis envoyé ; hors réseau il attend, et part au retour de la connexion (événement `online`, puis toutes
 * les 15 s). `onSynced` (relecture de la tournée) est attendu quand au moins une action est arrivée au
 * serveur, avant de retirer les actions envoyées de l'affichage.
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
          // L'état du serveur est relu avant de retirer les gestes de l'écran : pas de retour en arrière visible.
          if (result.sent.length > 0) await syncedRef.current().catch(() => undefined);
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
    const handleOnline = () => {
      setOnline(true);
      void process();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const timer = window.setInterval(() => void process(), RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(timer);
    };
  }, [ownerId, process, refresh]);

  return {
    actions,
    online,
    storageError,
    enqueue,
    discard,
    retry: () => process(true),
  };
}
