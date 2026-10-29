"use client";

import * as React from "react";
import { CheckCircle2, Loader2, LocateOff, RefreshCw, Satellite, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  driverLocationStatusMessage,
  type DriverLocationClientStatus,
} from "@/lib/tracking/driver-location-client";

const retryable = new Set<DriverLocationClientStatus>([
  "denied", "unavailable", "timeout", "offline", "sync-error", "stale",
]);

export function DriverLocationStatus({
  status,
  lastPositionAt,
  lastSyncedAt,
  error,
  detail,
  onRetry,
  compact = false,
}: {
  status: DriverLocationClientStatus;
  lastPositionAt?: string | null;
  lastSyncedAt?: string | null;
  error?: string | null;
  detail?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const failure = ["denied", "unavailable", "timeout", "offline", "sync-error", "stale"].includes(status);
  const Icon = status === "synced"
    ? CheckCircle2
    : status === "requesting"
      ? Loader2
      : status === "offline"
        ? WifiOff
        : failure || status === "unsupported"
          ? LocateOff
          : Satellite;
  const message = detail ?? driverLocationStatusMessage({ status, lastPositionAt, lastSyncedAt, error });

  return (
    <div
      role={failure ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
        status === "synced" && "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-success/40 dark:bg-success-subtle dark:text-foreground",
        status === "requesting" && "border-blue-200 bg-blue-50 text-blue-950 dark:border-[#2f4260] dark:bg-[#1d242c] dark:text-foreground",
        failure && "border-amber-300 bg-amber-50 text-amber-950 dark:border-warning/40 dark:bg-warning-subtle dark:text-foreground",
        (status === "stopped" || status === "unsupported") && "bg-muted/50 text-muted-foreground",
        compact && "rounded-xl bg-white/95 shadow-lg dark:bg-card/95"
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", status === "requesting" && "animate-spin")} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {lastPositionAt && status !== "synced" && (
          <p className="mt-0.5 text-xs opacity-80">
            Dernier signal local : {new Date(lastPositionAt).toLocaleString("fr-FR")}.
          </p>
        )}
      </div>
      {onRetry && retryable.has(status) && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Réessayer
        </Button>
      )}
    </div>
  );
}
