import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import { DEFAULT_FIT_PADDING, getMapLayoutPadding, type MapFitPadding } from "./map-layout-padding";
export type { MapFitPadding } from "./map-layout-padding";

export function getDispatchMapFitPadding(map: LeafletMap): MapFitPadding {
  const page = map.getContainer().closest("[data-dispatch-map-page]");
  const panel = page?.querySelector("[data-dispatch-map-panel]") as HTMLElement | null;

  if (!page || !panel) {
    return DEFAULT_FIT_PADDING;
  }

  const pageRect = page.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  return getMapLayoutPadding(pageRect, panelRect);
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
