import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// DESIGN-1, finitions du 29 octobre 2026 (audit axe, zoom 200 %, transparence réduite).
const read = (file: string) => readFileSync(file, "utf8");

test("DESIGN-1 : l'erreur de chargement des commandes et de l'historique propose « Réessayer »", () => {
  for (const file of ["src/features/client-portal/client-orders-content.tsx", "src/features/client-portal/client-orders-history-content.tsx"]) {
    const source = read(file);
    assert.match(source, /error, refetch \} = usePortalOrders/, file);
    assert.match(source, /action=\{\{ label: "Réessayer", onClick: \(\) => void refetch\(\) \}\}/, file);
  }
});

test("DESIGN-1 : la barre de statut de la carte n'écrit plus en 10 ou 11 px", () => {
  assert.doesNotMatch(read("src/components/maps/delivery-map-status-bar.tsx"), /text-\[1[01]px\]/);
});

test("DESIGN-1 : transparence réduite, aucun flou d'arrière-plan dans tous les espaces", () => {
  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("@media (prefers-reduced-transparency: reduce)"));
  assert.match(block, /:root\[data-theme\] \[class\*="backdrop-blur"\] \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;/);
});

test("DESIGN-1 : contrastes AA relevés par axe (barre de démo, pastille d'alerte de la carte)", () => {
  assert.doesNotMatch(read("src/features/demo/demo-mode-bar.tsx"), /text-amber-800\/80/);
  const status = read("src/features/back-office/dispatch-map-status.ts");
  assert.doesNotMatch(status, /#a8560d/);
  assert.match(status, /text-\[#9a4e0c\]/);
});
