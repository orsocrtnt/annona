import type { FieldError, FieldErrors } from "react-hook-form";

function isFieldError(value: unknown): value is FieldError {
  return typeof value === "object" && value !== null && "message" in value;
}

export function flattenFormErrors(errors: FieldErrors, prefix = ""): string[] {
  const messages: string[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (isFieldError(value) && value.message) {
      messages.push(String(value.message));
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        messages.push(...flattenFormErrors(entry as FieldErrors, `${path}.${index}`));
      });
      continue;
    }

    if (typeof value === "object") {
      messages.push(...flattenFormErrors(value as FieldErrors, path));
    }
  }

  return [...new Set(messages)];
}

export function pickupStopHasError(errors: FieldErrors, index: number) {
  const pickupErrors = errors.pickupStops;
  if (!pickupErrors) return false;

  if (isFieldError(pickupErrors)) return index === 0;

  if (!Array.isArray(pickupErrors)) return false;

  const stop = pickupErrors[index];
  if (!stop || typeof stop !== "object") return false;

  return Boolean(
    stop.address ||
      stop.city ||
      stop.postalCode ||
      stop.items ||
      stop.label ||
      stop.root
  );
}

export function stopHasError(errors: FieldErrors, index: number) {
  const stopErrors = errors.stops;
  if (!stopErrors) return false;

  if (isFieldError(stopErrors)) return index === 0;

  if (!Array.isArray(stopErrors)) return false;

  const stop = stopErrors[index];
  if (!stop || typeof stop !== "object") return false;

  return Boolean(stop.address || stop.city || stop.postalCode || stop.label || stop.root);
}

export function findFirstPickupStopErrorIndex(errors: FieldErrors) {
  const pickupErrors = errors.pickupStops;
  if (!pickupErrors) return null;

  if (isFieldError(pickupErrors)) return 0;

  if (Array.isArray(pickupErrors)) {
    for (let index = 0; index < pickupErrors.length; index += 1) {
      if (pickupStopHasError(errors, index)) return index;
    }
  }

  return null;
}

export function findFirstStopErrorIndex(errors: FieldErrors) {
  const stopErrors = errors.stops;
  if (!stopErrors) return null;

  if (isFieldError(stopErrors)) return 0;

  if (Array.isArray(stopErrors)) {
    for (let index = 0; index < stopErrors.length; index += 1) {
      if (stopHasError(errors, index)) return index;
    }
  }

  return null;
}

export function getPickupStopErrorMessage(errors: FieldErrors, index: number) {
  const pickupErrors = errors.pickupStops;
  if (!pickupErrors) return undefined;

  if (isFieldError(pickupErrors)) return pickupErrors.message;

  if (!Array.isArray(pickupErrors)) return undefined;

  const stop = pickupErrors[index];
  if (!stop || typeof stop !== "object") return undefined;

  return flattenFormErrors(stop as FieldErrors)[0];
}

export function getFirstFormErrorMessage(errors: FieldErrors) {
  const allMessages = flattenFormErrors(errors);
  const pickupIndex = findFirstPickupStopErrorIndex(errors);
  if (pickupIndex !== null) {
    return {
      title: `Collecte ${pickupIndex + 1} incomplète`,
      description:
        getPickupStopErrorMessage(errors, pickupIndex) ??
        allMessages[0] ??
        "Complétez l'adresse et les articles de cette collecte",
      pickupIndex,
    };
  }

  const stopIndex = findFirstStopErrorIndex(errors);
  if (stopIndex !== null) {
    return {
      title: `Adresse ${stopIndex + 1} incomplète`,
      description: allMessages[0] ?? "Complétez cette adresse",
      stopIndex,
    };
  }

  if (allMessages.length > 0) {
    return {
      title: "Formulaire incomplet",
      description: allMessages.slice(0, 3).join(" · "),
    };
  }

  return {
    title: "Formulaire incomplet",
    description: "Vérifiez les champs obligatoires",
  };
}
