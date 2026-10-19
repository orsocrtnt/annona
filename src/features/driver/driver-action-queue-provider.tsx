"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { driverApi, DriverApiError } from "./api";
import {
  browserDriverActionQueueStore,
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  type QueuedDriverAction,
  type QueuedDriverActionPayload,
} from "./offline-action-queue";

export type DriverActionSubmission = {
  disposition: "sent" | "queued";
};

type DriverActionQueueContextValue = {
  actions: QueuedDriverAction[];
  isProcessing: boolean;
  submit: (missionId: string, payload: QueuedDriverActionPayload) => Promise<DriverActionSubmission>;
  retry: () => Promise<void>;
  discard: (id: string) => Promise<void>;
};

const DriverActionQueueContext = createContext<DriverActionQueueContextValue | null>(null);

export function DriverActionQueueProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ownerId = user?.id ?? null;
  const [actions, setActions] = useState<QueuedDriverAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerId) {
      setActions([]);
      return [];
    }
    const next = await browserDriverActionQueueStore.list(ownerId);
    setActions(next);
    return next;
  }, [ownerId]);

  const processQueue = useCallback(async (force = false) => {
    if (!ownerId || (typeof navigator !== "undefined" && !navigator.onLine)) {
      await refresh();
      return;
    }
    if (processingRef.current) return processingRef.current;

    const run = (async () => {
      setIsProcessing(true);
      try {
        const result = await processQueuedDriverActions({
          store: browserDriverActionQueueStore,
          ownerId,
          force,
          send: (action) =>
            driverApi.updateMissionStatus(action.missionId, action.payload.status, {
              purchaseItems: action.payload.purchaseItems,
              confirmOutOfRange: action.payload.confirmOutOfRange,
              latitude: action.payload.latitude,
              longitude: action.payload.longitude,
              pod: action.payload.pod,
            }),
        });
        if (result.sent.length > 0) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["driver"] }),
            queryClient.invalidateQueries({ queryKey: ["company"] }),
          ]);
        }
      } finally {
        await refresh();
        setIsProcessing(false);
      }
    })();
    processingRef.current = run;
    try {
      await run;
    } finally {
      processingRef.current = null;
    }
  }, [ownerId, queryClient, refresh]);

  useEffect(() => {
    if (!ownerId) return;
    void refresh().then(() => processQueue());
    const onOnline = () => void processQueue(true);
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => void processQueue(), 15_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [ownerId, processQueue, refresh]);

  const submit = useCallback(async (
    missionId: string,
    payload: QueuedDriverActionPayload
  ): Promise<DriverActionSubmission> => {
    if (!ownerId) throw new DriverApiError("Session chauffeur indisponible.", { retryable: false });
    const action = createQueuedDriverAction({ ownerId, missionId, payload });
    try {
      await enqueueDriverAction(browserDriverActionQueueStore, action);
    } catch (error) {
      if (error instanceof Error && error.message === "MISSION_ACTION_ALREADY_QUEUED") {
        throw new DriverApiError(
          "Une action est déjà enregistrée pour cette mission. Attendez sa synchronisation ou retirez-la.",
          { retryable: false }
        );
      }
      throw new DriverApiError(
        "Impossible de conserver l’action sur cet appareil. La mission n’a pas été modifiée.",
        { retryable: false }
      );
    }
    await refresh();
    await processQueue(true);
    const remaining = (await browserDriverActionQueueStore.list(ownerId)).find(
      (candidate) => candidate.id === action.id
    );
    if (!remaining) return { disposition: "sent" };
    if (remaining.state === "failed") {
      throw new DriverApiError(remaining.lastError ?? "Action refusée par le serveur.", {
        retryable: false,
      });
    }
    return { disposition: "queued" };
  }, [ownerId, processQueue, refresh]);

  const retry = useCallback(async () => {
    await processQueue(true);
  }, [processQueue]);

  const discard = useCallback(async (id: string) => {
    const action = actions.find((candidate) => candidate.id === id);
    if (!action || action.ownerId !== ownerId) return;
    await browserDriverActionQueueStore.delete(id);
    await refresh();
  }, [actions, ownerId, refresh]);

  const value = useMemo<DriverActionQueueContextValue>(() => ({
    actions,
    isProcessing,
    submit,
    retry,
    discard,
  }), [actions, discard, isProcessing, retry, submit]);

  return (
    <DriverActionQueueContext.Provider value={value}>
      {children}
    </DriverActionQueueContext.Provider>
  );
}

export function useDriverActionQueue() {
  const value = useContext(DriverActionQueueContext);
  if (!value) throw new Error("DriverActionQueueProvider manquant");
  return value;
}

export function useQueuedDriverAction(missionId: string) {
  const { actions } = useDriverActionQueue();
  return actions.find((action) => action.missionId === missionId) ?? null;
}
