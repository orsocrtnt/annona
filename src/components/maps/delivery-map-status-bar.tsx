"use client";

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

const STEP_PALETTE = [
  { color: "#f59e0b", text: "#b45309", muted: "#f59e0b40" },
  { color: "#2563eb", text: "#1d4ed8", muted: "#2563eb40" },
  { color: "#7c3aed", text: "#5b21b6", muted: "#7c3aed40" },
  { color: "#ea580c", text: "#c2410c", muted: "#ea580c40" },
  { color: "#16a34a", text: "#15803d", muted: "#16a34a40" },
] as const;

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

function connectorGradient(fromIndex: number, toIndex: number, state: ConnectorState) {
  const from = STEP_PALETTE[fromIndex]!.color;
  const to = STEP_PALETTE[toIndex]!.color;

  if (state === "completed") {
    return `linear-gradient(90deg, ${from} 0%, ${to} 100%)`;
  }

  if (state === "loading") {
    return `linear-gradient(90deg, ${from}88 0%, ${to}88 100%)`;
  }

  return `linear-gradient(90deg, ${from}55 0%, ${to}55 100%)`;
}

function loadingShimmerGradient(fromIndex: number, toIndex: number) {
  const from = STEP_PALETTE[fromIndex]!.color;
  const to = STEP_PALETTE[toIndex]!.color;

  return `linear-gradient(
    90deg,
    transparent 0%,
    ${from} 20%,
    ${to} 50%,
    ${from} 80%,
    transparent 100%
  )`;
}

function StepConnector({
  fromIndex,
  toIndex,
  state,
}: {
  fromIndex: number;
  toIndex: number;
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
        className={cn("absolute inset-0 rounded-full", isLoading && "delivery-step-connector-loading-track")}
        style={{ background: connectorGradient(fromIndex, toIndex, state) }}
      />

      {isLoading && (
        <div
          className="delivery-step-connector-loading absolute inset-0 rounded-full"
          style={{
            background: loadingShimmerGradient(fromIndex, toIndex),
            backgroundSize: "200% 100%",
          }}
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
          const palette = STEP_PALETTE[index]!;
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
                    "h-3 w-3 shrink-0 rounded-full transition-all duration-300",
                    isCurrent && "scale-110"
                  )}
                  style={{
                    backgroundColor:
                      isCompleted || isCurrent ? palette.color : palette.muted,
                    boxShadow: isCurrent
                      ? `0 0 0 3px ${palette.color}33, 0 0 10px ${palette.color}55`
                      : isCompleted
                        ? `0 0 6px ${palette.color}44`
                        : undefined,
                  }}
                />
                <span
                  className={cn(
                    "w-full px-0.5 text-center text-[10px] leading-tight transition-colors duration-300 sm:text-[11px]",
                    isCurrent && "font-semibold",
                    isCompleted && "font-medium",
                    isUpcoming && "text-muted-foreground/80"
                  )}
                  style={{
                    color: isCurrent || isCompleted ? palette.text : undefined,
                  }}
                >
                  {label}
                </span>
              </div>

              {!isLast && (
                <StepConnector
                  fromIndex={index}
                  toIndex={index + 1}
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
