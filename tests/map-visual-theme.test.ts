import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MAP_ROUTE_STYLE, MAP_VISUAL_THEME } from "../src/lib/maps/map-visual-theme";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

test("MAP-3 : le trajet vert garde au moins 3:1 sur son liseré blanc et sur le plan Menthe", () => {
  assert.ok(contrast(MAP_VISUAL_THEME.route, MAP_VISUAL_THEME.routeHalo) >= 3);
  assert.ok(contrast(MAP_VISUAL_THEME.route, MAP_VISUAL_THEME.land) >= 3);
  assert.equal(MAP_ROUTE_STYLE.line.color, MAP_VISUAL_THEME.route);
  assert.ok(MAP_ROUTE_STYLE.halo.weight > MAP_ROUTE_STYLE.line.weight);
});
