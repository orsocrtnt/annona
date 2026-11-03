import type { NavigationRouteStep } from "@/lib/maps/navigation-route";
import {
  formatDistance,
  haversineMeters,
} from "@/lib/maps/navigation-utils";

export type TurnIconKind =
  | "straight"
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "uturn"
  | "roundabout"
  | "arrive"
  | "depart";

export type NavigationGuidance = {
  stepIndex: number;
  distanceToManeuver: number;
  distanceLabel: string;
  primaryAction: string;
  streetName: string | null;
  fullInstruction: string;
  icon: TurnIconKind;
  isImminent: boolean;
  nextPreview: string | null;
};

export function resolveTurnIcon(
  maneuverType: string,
  modifier?: string | null
): TurnIconKind {
  if (maneuverType === "arrive") return "arrive";
  if (maneuverType === "depart") return "depart";
  if (maneuverType === "roundabout" || maneuverType === "rotary") return "roundabout";

  if (modifier?.includes("uturn")) return "uturn";
  if (modifier === "slight left") return "slight-left";
  if (modifier === "slight right") return "slight-right";
  if (modifier === "sharp left" || modifier === "left") return "left";
  if (modifier === "sharp right" || modifier === "right") return "right";

  return "straight";
}

export function buildPrimaryTurnLabel(maneuverType: string, modifier?: string | null): string {
  if (maneuverType === "arrive") return "Arrivée à destination";
  if (maneuverType === "roundabout" || maneuverType === "rotary") return "Prenez le rond-point";
  if (modifier === "uturn") return "Faites demi-tour";
  if (modifier === "slight left") return "Légèrement à gauche";
  if (modifier === "slight right") return "Légèrement à droite";
  if (modifier === "sharp left" || modifier === "left") return "Tournez à gauche";
  if (modifier === "sharp right" || modifier === "right") return "Tournez à droite";
  if (modifier === "straight") return "Continuez tout droit";
  if (maneuverType === "turn") return "Tournez";
  if (maneuverType === "merge") return "Insérez-vous";
  if (maneuverType === "ramp") return "Prenez la bretelle";
  if (maneuverType === "fork") return "Gardez votre direction";
  return "Continuez";
}

export function findActiveStepIndex(
  position: { latitude: number; longitude: number },
  steps: NavigationRouteStep[]
): number {
  if (steps.length === 0) return 0;

  let activeIndex = 0;
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!;
    const distance = haversineMeters(position, step);

    if (step.maneuverType === "depart" && distance < 45 && index < steps.length - 1) {
      activeIndex = index + 1;
      continue;
    }

    if (distance < 40 && index < steps.length - 1) {
      activeIndex = index + 1;
      continue;
    }

    activeIndex = index;
    break;
  }

  return activeIndex;
}

export function getNavigationGuidance(
  position: { latitude: number; longitude: number },
  steps: NavigationRouteStep[]
): NavigationGuidance | null {
  if (steps.length === 0) return null;

  const stepIndex = findActiveStepIndex(position, steps);
  const step = steps[stepIndex]!;
  const distanceToManeuver = haversineMeters(position, step);
  const isImminent = distanceToManeuver < 80 && step.maneuverType !== "depart";
  const nextStep = steps[stepIndex + 1] ?? null;

  const distanceLabel =
    step.maneuverType === "arrive"
      ? "Destination"
      : isImminent
        ? "Maintenant"
        : `Dans ${formatDistance(distanceToManeuver)}`;

  return {
    stepIndex,
    distanceToManeuver,
    distanceLabel,
    primaryAction: buildPrimaryTurnLabel(step.maneuverType, step.modifier),
    streetName: step.streetName?.trim() || null,
    fullInstruction: step.instruction,
    icon: resolveTurnIcon(step.maneuverType, step.modifier),
    isImminent,
    nextPreview: nextStep
      ? `Puis ${buildPrimaryTurnLabel(nextStep.maneuverType, nextStep.modifier).toLowerCase()}${
          nextStep.streetName ? ` — ${nextStep.streetName}` : ""
        }`
      : null,
  };
}

export { buildManeuverInstruction, computeBearing, formatDistance } from "@/lib/maps/navigation-utils";
