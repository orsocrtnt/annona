"use client";

import { useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDriverActionQueue } from "./driver-action-queue-provider";
import { actionNeedsAttention } from "./offline-action-queue";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function DriverActionQueueStatus() {
  const { actions: queued, isProcessing, retry, discard } = useDriverActionQueue();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const actions = queued.filter((action) => actionNeedsAttention(action, online));
  if (actions.length === 0) return null;

  const failed = actions.filter((action) => action.state === "failed");
  const firstFailed = failed[0];

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-3" aria-live="polite">
      <Alert variant={failed.length > 0 ? "destructive" : "warning"}>
        <AlertTitle>
          {failed.length > 0
            ? "Une action demande votre attention"
            : `${actions.length} action${actions.length > 1 ? "s" : ""} en attente`}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {failed.length > 0
              ? firstFailed?.lastError ?? "Le serveur a refusé cette action."
              : "La preuve et l’action sont conservées sur cet appareil et seront renvoyées automatiquement avec le même contenu."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={isProcessing} onClick={() => void retry()}>
              Réessayer maintenant
            </Button>
            {firstFailed && (
              <Button size="sm" variant="ghost" disabled={isProcessing} onClick={() => void discard(firstFailed.id)}>
                Retirer l’action refusée
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
