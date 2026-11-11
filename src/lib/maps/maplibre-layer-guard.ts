// Fond vectoriel (couche @maplibre/maplibre-gl-leaflet 0.1.4, version figée dans package.json).
// Sur un redimensionnement ou une fin de transition, le greffon recale le fond à l'image suivante
// et y lit `this._map`. Si l'on change de page entre-temps, la couche a déjà quitté la carte
// (`_map` à null) : « TypeError: Cannot read properties of null (reading 'getZoom') » dans la console.
// Même traitement que le greffon, exécuté seulement si la couche est encore sur la carte.

interface LatLngLike {
  lat: number;
  lng: number;
}

interface MapLike {
  getZoom(): number;
  getCenter(): LatLngLike;
  getBounds(): { getNorthWest(): unknown };
  latLngToContainerPoint(latlng: unknown): unknown;
}

interface GlMapLike {
  _actualCanvas: HTMLElement;
  once(event: "moveend", handler: () => void): unknown;
  jumpTo(options: { center: LatLngLike; zoom: number }): unknown;
}

/** Champs internes du greffon utilisés ici. */
export interface MaplibreLayerInternals {
  _map: MapLike | null;
  _glMap: GlMapLike | null;
  _resizeContainer(): void;
  _zoomEnd(): void;
  _transitionEnd: (event?: unknown) => void;
}

export interface FrameTools {
  requestFrame(callback: () => void): unknown;
  setTransform(element: HTMLElement, offset: unknown, scale: number): void;
}

/** À appeler avant `addTo(map)` : le greffon branche `_transitionEnd` au moment de l'ajout. */
export function guardMaplibreTransitionEnd(layer: MaplibreLayerInternals, tools: FrameTools) {
  layer._transitionEnd = () => {
    tools.requestFrame(() => {
      const map = layer._map;
      const gl = layer._glMap;
      if (!map || !gl) return;
      const zoom = map.getZoom();
      const center = map.getCenter();
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest());
      layer._resizeContainer();
      tools.setTransform(gl._actualCanvas, offset, 1);
      gl.once("moveend", () => {
        if (layer._map && layer._glMap) layer._zoomEnd();
      });
      gl.jumpTo({ center, zoom: zoom - 1 });
    });
  };
}
