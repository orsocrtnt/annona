import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { guardMaplibreTransitionEnd, type MaplibreLayerInternals } from "../src/lib/maps/maplibre-layer-guard";

// RECETTE-V1 (10 novembre 2026) : « TypeError: Cannot read properties of null (reading 'getZoom') »
// côté admin en changeant de page, quand la carte du fond vectoriel est démontée.

function fakeLayer() {
  const calls: string[] = [];
  const map = {
    getZoom: () => 13,
    getCenter: () => ({ lat: 48.85, lng: 2.35 }),
    getBounds: () => ({ getNorthWest: () => "nw" }),
    latLngToContainerPoint: () => "offset",
  };
  const gl = {
    _actualCanvas: {} as HTMLElement,
    once: (_event: "moveend", handler: () => void) => {
      calls.push("once");
      gl.pending = handler;
    },
    jumpTo: (options: { zoom: number }) => calls.push(`jumpTo:${options.zoom}`),
    pending: null as null | (() => void),
  };
  const layer: MaplibreLayerInternals = {
    _map: map,
    _glMap: gl,
    _resizeContainer: () => calls.push("resize"),
    _zoomEnd: () => calls.push("zoomEnd"),
    _transitionEnd: () => {
      throw new Error("non remplacé");
    },
  };
  const frames: Array<() => void> = [];
  const tools = {
    requestFrame: (callback: () => void) => frames.push(callback),
    setTransform: (_element: HTMLElement, offset: unknown, scale: number) => calls.push(`transform:${String(offset)}:${scale}`),
  };
  return { layer, gl, calls, frames, tools };
}

test("RECETTE-V1 carte : couche retirée avant l'image suivante → aucune erreur, rien n'est touché", () => {
  const { layer, calls, frames, tools } = fakeLayer();
  guardMaplibreTransitionEnd(layer, tools);
  layer._transitionEnd();
  // Changement de page : Leaflet retire la couche, le greffon détruit la carte MapLibre.
  layer._map = null;
  layer._glMap = null;
  assert.equal(frames.length, 1);
  assert.doesNotThrow(() => frames[0]!());
  assert.deepEqual(calls, []);
});

test("RECETTE-V1 carte : couche encore affichée → même recalage que le greffon (zoom − 1)", () => {
  const { layer, gl, calls, frames, tools } = fakeLayer();
  guardMaplibreTransitionEnd(layer, tools);
  layer._transitionEnd();
  frames[0]!();
  assert.deepEqual(calls, ["resize", "transform:offset:1", "once", "jumpTo:12"]);
  gl.pending!();
  assert.equal(calls.at(-1), "zoomEnd");
});

test("RECETTE-V1 carte : fin de déplacement reçue après retrait → pas de _zoomEnd", () => {
  const { layer, gl, calls, frames, tools } = fakeLayer();
  guardMaplibreTransitionEnd(layer, tools);
  layer._transitionEnd();
  frames[0]!();
  layer._map = null;
  gl.pending!();
  assert.ok(!calls.includes("zoomEnd"));
});

test("RECETTE-V1 carte : le greffon reste en 0.1.4 et la garde est posée avant l'ajout à la carte", () => {
  // Le remplacement recopie le corps de `_transitionEnd` de cette version précise.
  assert.equal(JSON.parse(readFileSync("package.json", "utf8")).dependencies["@maplibre/maplibre-gl-leaflet"], "0.1.4");
  const source = readFileSync("src/components/maps/vector-base-layer.tsx", "utf8");
  const guard = source.indexOf("guardMaplibreTransitionEnd(layer");
  const add = source.indexOf("layer.addTo(map)");
  assert.ok(guard > 0 && add > guard, "garde posée avant addTo");
});
