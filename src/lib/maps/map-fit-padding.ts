import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";

export interface MapFitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DEFAULT_FIT_PADDING: MapFitPadding = {
  top: 80,
  right: 80,
  bottom: 120,
  left: 80,
};

export function getDispatchMapFitPadding(map: LeafletMap): MapFitPadding {
  const page = map.getContainer().closest("[data-dispatch-map-page]");
  const panel = page?.querySelector("[data-dispatch-map-panel]") as HTMLElement | null;

  if (!page || !panel) {
    return DEFAULT_FIT_PADDING;
  }

  const pageRect = page.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  const left = Math.max(DEFAULT_FIT_PADDING.left, panelRect.right - pageRect.left + 24);
  const top = Math.max(DEFAULT_FIT_PADDING.top, 72);

  return {
    top,
    right: DEFAULT_FIT_PADDING.right,
    bottom: DEFAULT_FIT_PADDING.bottom,
    left,
  };
}

export function fitMapBoundsWithPadding(
  map: LeafletMap,
  bounds: L.LatLngBounds,
  padding: MapFitPadding,
  maxZoom = 15
) {
  map.fitBounds(bounds, {
    paddingTopLeft: L.point(padding.left, padding.top),
    paddingBottomRight: L.point(padding.right, padding.bottom),
    maxZoom,
    animate: false,
  });
}

export function fitMapPointsWithPadding(
  map: LeafletMap,
  points: [number, number][],
  padding: MapFitPadding,
  maxZoom = 15,
  singleZoom = 14
) {
  if (points.length === 0) return;

  if (points.length === 1) {
    const bounds = L.latLngBounds([points[0]!, points[0]!]);
    map.fitBounds(bounds, {
      paddingTopLeft: L.point(padding.left, padding.top),
      paddingBottomRight: L.point(padding.right, padding.bottom),
      maxZoom: singleZoom,
      animate: false,
    });
    return;
  }

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const bounds = L.latLngBounds(
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  );

  fitMapBoundsWithPadding(map, bounds, padding, maxZoom);
}
