/** Géométrie du plan SVG de la mini-démo (viewBox 0 0 400 300). */
export type Point = { x: number; y: number };

/** De l'entrepôt d'Ivry (sud-est) à la rue de la Roquette (nord), en suivant les rues dessinées. */
export const TOUR_ROUTE: readonly Point[] = [
  { x: 336, y: 268 },
  { x: 336, y: 214 },
  { x: 256, y: 214 },
  { x: 256, y: 140 },
  { x: 176, y: 140 },
  { x: 176, y: 62 },
];

/** Position à la fraction `t` de la longueur totale du trajet (t borné à [0, 1]). */
export function pointAlongRoute(route: readonly Point[], t: number): Point {
  const first = route[0];
  if (!first) return { x: 0, y: 0 };
  const lengths = route.slice(1).map((point, index) => {
    const previous = route[index] ?? point;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.min(Math.max(t, 0), 1) * total;

  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index] ?? 0;
    const from = route[index] ?? first;
    const to = route[index + 1] ?? from;
    if (remaining <= length && length > 0) {
      const ratio = remaining / length;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    remaining -= length;
  }
  return route[route.length - 1] ?? first;
}
