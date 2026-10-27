import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryMapStatusBar } from "../src/components/maps/delivery-map-status-bar";
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

test("MAP-3 : le trajet et sa surface noire/blanche gardent un contraste fort", () => {
  assert.ok(contrast(MAP_VISUAL_THEME.route, MAP_VISUAL_THEME.routeHalo) >= 7);
  assert.equal(MAP_ROUTE_STYLE.line.color, MAP_VISUAL_THEME.ink);
  assert.ok(MAP_ROUTE_STYLE.halo.weight > MAP_ROUTE_STYLE.line.weight);
});

test("MAP-3 : la progression reste compréhensible sans palette arc-en-ciel", () => {
  const html = renderToStaticMarkup(
    DeliveryMapStatusBar({ status: "IN_DELIVERY", deliveryCategory: "STANDARD" })
  );
  assert.match(html, /Statut : En cours de livraison/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /bg-black/);
  assert.doesNotMatch(html, /#2563eb|#7c3aed|#ea580c|#16a34a|#f59e0b/);
});

test("MAP-3 : plan vectoriel Menthe commun aux cartes, plan raster gris en secours", () => {
  const base = readFileSync("src/components/maps/leaflet-base-map-inner.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(base, /variant = "uber"/);
  assert.match(base, /leaflet-map-host--uber/);
  assert.match(base, /<BaseMapLayer/);
  // Le filtre gris ne s'applique qu'au plan raster de secours, jamais au vectoriel.
  assert.match(css, /leaflet-map-host--uber:not\(\.leaflet-map-host--vector\) \.leaflet-tile-pane/);
  assert.match(css, /grayscale\(1\)[\s\S]*saturate\(0\)/);
});

test("MAP-3 : sélection, regroupements visuels et panne fournisseur restent explicites", () => {
  const deliveryMarker = readFileSync("src/components/maps/delivery-point-marker.tsx", "utf8");
  const driverMarker = readFileSync("src/components/maps/driver-map-marker.tsx", "utf8");
  const dispatchPanel = readFileSync(
    "src/features/back-office/dispatch-deliveries-map-panel.tsx",
    "utf8"
  );
  const portalPanel = readFileSync(
    "src/features/client-portal/portal-deliveries-map-panel.tsx",
    "utf8"
  );
  const provider = readFileSync("src/components/maps/provider-tile-layer.tsx", "utf8");

  assert.match(deliveryMarker, /dotSize = isSelected \? 16 : 13/);
  assert.match(deliveryMarker, /selectedSurface = isSelected \? MAP_VISUAL_THEME\.ink/);
  assert.match(deliveryMarker, /stepTextColor = muted \? MAP_VISUAL_THEME\.ink/);
  assert.match(driverMarker, /isSelected \? MAP_VISUAL_THEME\.ink/);
  assert.match(dispatchPanel, /shadow-\[inset_3px_0_0_#111111\]/);
  assert.match(portalPanel, /shadow-\[inset_3px_0_0_#111111\]/);
  assert.match(provider, /Fond de carte indisponible\. Les positions restent affichées\./);
  assert.match(provider, /bg-black[\s\S]*Réessayer la carte/);
});
