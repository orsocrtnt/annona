/** Calculs purs du canevas de signature (testables sans navigateur). */

/** Même minimum que la validation serveur (`pod-signature.ts`) : en dessous, le PNG serait refusé. */
export const MIN_EXPORT_SIDE = 40;
/** Un tracé trop court (point isolé, effleurement) n'est pas une signature. */
export const MIN_STROKE_POINTS = 8;

type Size = { width: number; height: number };

/**
 * Taille interne du canevas à partir de sa taille de mise en page (`clientWidth/clientHeight`).
 * Null tant que le dialogue n'est pas mis en page (largeur ou hauteur nulle).
 */
export function canvasBackingSize(layout: Size, devicePixelRatio: number): Size | null {
  if (!(layout.width >= 1) || !(layout.height >= 1)) return null;
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  return { width: Math.round(layout.width * ratio), height: Math.round(layout.height * ratio) };
}

/**
 * Position du pointeur en pixels de mise en page. Le rectangle visuel peut être réduit par l'animation
 * d'ouverture du dialogue (transform) : on le ramène à la taille de mise en page.
 */
export function pointerToCanvas(
  rect: { left: number; top: number; width: number; height: number },
  layout: Size,
  clientX: number,
  clientY: number
) {
  if (!(rect.width > 0) || !(rect.height > 0)) return { x: 0, y: 0 };
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    x: round((clientX - rect.left) * (layout.width / rect.width)),
    y: round((clientY - rect.top) * (layout.height / rect.height)),
  };
}

/** Taille du PNG exporté : réduite à `maxWidth` au plus, null si un côté passerait sous le minimum serveur. */
export function exportSize(canvas: Size, maxWidth: number): Size | null {
  if (!(canvas.width >= 1) || !(canvas.height >= 1)) return null;
  const scale = Math.min(1, maxWidth / canvas.width);
  const width = Math.round(canvas.width * scale);
  const height = Math.round(canvas.height * scale);
  return width >= MIN_EXPORT_SIDE && height >= MIN_EXPORT_SIDE ? { width, height } : null;
}

export function isSignatureExportable(input: { points: number; width: number; height: number }) {
  return input.points >= MIN_STROKE_POINTS && input.width >= MIN_EXPORT_SIDE && input.height >= MIN_EXPORT_SIDE;
}
