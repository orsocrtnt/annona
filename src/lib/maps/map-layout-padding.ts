export interface MapFitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_FIT_PADDING: MapFitPadding = { top: 80, right: 80, bottom: 120, left: 80 };

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/** A floating mobile panel consumes vertical space, not the whole map width. */
export function getMapLayoutPadding(page: Rect, panel: Rect | null): MapFitPadding {
  const side = Math.min(80, page.width * 0.1);
  const base = { ...DEFAULT_FIT_PADDING, left: side, right: side };
  if (!panel || panel.width === 0 || panel.height === 0) return base;

  if (panel.width > page.width * 0.45) {
    return {
      ...base,
      top: Math.min(Math.max(base.top, panel.bottom - page.top + 24), page.height * 0.55),
    };
  }

  return { ...base, left: Math.max(base.left, panel.right - page.left + 24) };
}
