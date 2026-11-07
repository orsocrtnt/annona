"use client";

import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionNeedsAttention, type QueuedDriverAction } from "@/features/driver/offline-action-queue";
import { fr } from "@/lib/i18n/fr";

const t = fr.driverRound;

interface SyncBannerProps {
  actions: QueuedDriverAction[];
  online: boolean;
  onRetry: () => void;
  onDiscard: (id: string) => void;
}

/** LIV-06 : actions gardées sur le téléphone, en attente du réseau, ou refusées par le serveur. */
export function SyncBanner({ actions, online, onRetry, onDiscard }: SyncBannerProps) {
  const failed = actions.filter((action) => action.state === "failed");
  // Un premier envoi en cours, en ligne, n'est pas « en attente » : pas de bannière qui clignote.
  const waiting = actions.filter((action) => action.state !== "failed" && actionNeedsAttention(action, online));
  if (failed.length === 0 && waiting.length === 0 && online) return null;

  return (
    <div className="space-y-2" data-testid="driver-sync-banner">
      {!online || waiting.length > 0 ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-foreground">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            {waiting.length > 0 ? <p className="font-semibold" data-testid="driver-pending-count">{t.pending(waiting.length)}</p> : <p className="font-semibold">{t.offline}</p>}
            {!online ? <p className="mt-0.5 text-muted-foreground">{t.pendingOffline}</p> : null}
          </div>
          {online && waiting.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onRetry} aria-label={t.retry}>
              <RefreshCw aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
      {failed.length > 0 ? (
        <div role="alert" className="rounded-2xl border border-error/40 bg-error-subtle px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-error">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            {t.failed(failed.length)}
          </p>
          <ul className="mt-2 space-y-2">
            {failed.map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-muted-foreground">{action.lastError}</span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={onRetry}>{t.retry}</Button>
                  <Button variant="ghost" size="sm" onClick={() => onDiscard(action.id)}>{t.discard}</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
