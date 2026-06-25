"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";

const STATUS_ORDER: DeliveryStatus[] = ["ASSIGNED", "PURCHASING", "IN_DELIVERY", "DELIVERED"];

interface MissionStepperProps {
  status: DeliveryStatus;
  category: DeliveryCategory;
}

/** Indicateur de progression de la mission (Assignée → Collecte/Achat → Livraison → Livré). */
export function MissionStepper({ status, category }: MissionStepperProps) {
  const steps = [
    { label: "Assignée" },
    { label: category === "COURIER" ? "Collecte" : "Achat" },
    { label: "Livraison" },
    { label: "Livré" },
  ];
  const currentIndex = STATUS_ORDER.indexOf(status);
  if (currentIndex < 0) return null;

  return (
    <div className="flex items-center" aria-label={`Étape ${currentIndex + 1} sur ${steps.length}`}>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-brand text-white",
                  active && "bg-brand text-white ring-4 ring-brand-subtle",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] leading-none",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 mb-4 h-0.5 flex-1 rounded-full transition-colors",
                  i < currentIndex ? "bg-brand" : "bg-muted"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
