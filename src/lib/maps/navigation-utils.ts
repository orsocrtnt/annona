export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} min`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

const MANEUVER_LABELS: Record<string, string> = {
  depart: "Départ",
  arrive: "Arrivée",
  turn: "Tournez",
  "new name": "Continuez",
  merge: "Insérez-vous",
  ramp: "Prenez la bretelle",
  rotary: "Prenez le rond-point",
  roundabout: "Prenez le rond-point",
  fork: "À la fourche",
  "end of road": "Fin de route",
  continue: "Continuez",
  "slight turn": "Légèrement",
  "sharp turn": "Fortement",
};

const MODIFIER_LABELS: Record<string, string> = {
  left: "à gauche",
  right: "à droite",
  "slight left": "légèrement à gauche",
  "slight right": "légèrement à droite",
  "sharp left": "fortement à gauche",
  "sharp right": "fortement à droite",
  straight: "tout droit",
  uturn: "demi-tour",
};

export function buildManeuverInstruction(
  type: string,
  modifier?: string | null,
  streetName?: string | null
): string {
  const base = MANEUVER_LABELS[type] ?? "Continuez";
  const mod = modifier ? MODIFIER_LABELS[modifier] : null;
  const street = streetName?.trim();

  if (type === "arrive") return "Vous êtes arrivé";
  if (type === "depart") return street ? `Départ — ${street}` : "Départ";
  if (mod) {
    return street ? `${base} ${mod} — ${street}` : `${base} ${mod}`;
  }
  return street ? `${base} — ${street}` : base;
}

export function findNextStepIndex(
  steps: { latitude: number; longitude: number }[],
  position: { latitude: number; longitude: number }
): number {
  if (steps.length === 0) return 0;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  steps.forEach((step, index) => {
    const distance = haversineMeters(position, step);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestDistance < 35 && bestIndex < steps.length - 1) {
    return bestIndex + 1;
  }

  return bestIndex;
}

export function computeBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => ((rad * 180) / Math.PI + 360) % 360;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return toDeg(Math.atan2(y, x));
}
