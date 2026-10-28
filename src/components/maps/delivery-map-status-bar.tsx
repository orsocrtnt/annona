"use client";

import React from "react";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import { mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { cn } from "@/lib/utils";

type TrackingStep = {
  key: "PENDING" | "ASSIGNED" | "PURCHASING" | "IN_DELIVERY" | "DELIVERED";
  label: string;
  courierLabel?: string;
};

const TRACKING_STEPS: TrackingStep[] = [
  { key: "PENDING", label: "En attente" },
  { key: "ASSIGNED", label: "Assigné" },
  { key: "PURCHASING", label: "En cours d'achat", courierLabel: "Collecté" },
  { key: "IN_DELIVERY", label: "En cours de livraison" },
  { key: "DELIVERED", label: "Livré" },
];

type ConnectorState = "completed" | "loading" | "upcoming";

function getStepIndex(status: DeliveryStatus): number {
  switch (status) {
    case "PENDING":
      return 0;
    case "ASSIGNED":
      return 1;
    case "PURCHASING":
      return 2;
    case "IN_DELIVERY":
      return 3;
    case "DELIVERED":
    case "INVOICED":
    case "PAID":
      return 4;
    case "FAILED":
    case "CANCELLED":
      return 4;
    default:
      return 0;
  }
}

function stepLabel(step: TrackingStep, deliveryCategory: DeliveryCategory, status?: DeliveryStatus) {
  if (step.key === "DELIVERED" && (status === "FAILED" || status === "CANCELLED")) {
    return status === "FAILED" ? "Échec" : "Annulé";
  }
  if (step.key === "PURCHASING" && deliveryCategory === "COURIER" && step.courierLabel) {
    return step.courierLabel;
  }
  return step.label;
}

function StepConnector({
  state,
}: {
  state: ConnectorState;
}) {
  const isLoading = state === "loading";

  return (
    <div
      aria-hidden
      className={cn(
        "relative mx-0.5 mt-[5px] h-[3px] min-w-[0.35rem] flex-1 overflow-hidden rounded-full sm:min-w-[0.75rem]",
        state === "upcoming" && "opacity-55"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full",
          state === "completed" ? "bg-black dark:bg-foreground" : state === "loading" ? "bg-zinc-400 dark:bg-muted-foreground" : "bg-zinc-200 dark:bg-border",
          isLoading && "delivery-step-connector-loading-track"
        )}
      />

      {isLoading && (
        <div
          className="delivery-step-connector-loading absolute inset-0 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent 0%, var(--map-glass-button-fg, #111111) 50%, transparent 100%)", backgroundSize: "200% 100%" }}
        />
      )}
    </div>
  );
}

interface DeliveryMapStatusBarProps {
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  className?: string;
}

export function DeliveryMapStatusBar({
  status,
  deliveryCategory,
  className,
}: DeliveryMapStatusBarProps) {
  const currentIndex = getStepIndex(status);
  const lastStepIndex = TRACKING_STEPS.length - 1;

  return (
    <div
      className={cn("pointer-events-none w-[min(100%,42rem)] px-3 py-2.5", className)}
      style={mapGlassCardStyle}
      role="status"
      aria-live="polite"
      aria-label={`Statut : ${stepLabel(TRACKING_STEPS[currentIndex]!, deliveryCategory, status)}`}
    >
      <ol className="flex items-start">
        {TRACKING_STEPS.map((step, index) => {
          const label = stepLabel(step, deliveryCategory, status);
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;
          const isLast = index === lastStepIndex;

          const connectorState: ConnectorState =
            index < currentIndex
              ? "completed"
              : index === currentIndex && currentIndex < lastStepIndex
                ? "loading"
                : "upcoming";

          return (
            <li
              key={step.key}
              className={cn("flex min-w-0 flex-1 items-start", isLast && "flex-none")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-3 w-3 shrink-0 rounded-full border transition-all duration-300",
                    isCompleted && "border-black bg-black dark:border-foreground dark:bg-foreground",
                    isCurrent && "scale-110 border-black bg-black ring-4 ring-black/10 dark:border-foreground dark:bg-foreground dark:ring-white/15",
                    isUpcoming && "border-zinc-300 bg-white dark:border-muted-foreground dark:bg-card"
                  )}
                />
                <span
                  className={cn(
                    "w-full px-0.5 text-center text-[10px] leading-tight transition-colors duration-300 sm:text-[11px]",
                    isCurrent && "font-semibold text-black dark:text-foreground",
                    isCompleted && "font-medium text-zinc-700 dark:text-text-secondary",
                    isUpcoming && "text-muted-foreground/80"
                  )}
                >
                  {label}
                </span>
              </div>

              {!isLast && (
                <StepConnector
                  state={connectorState}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
