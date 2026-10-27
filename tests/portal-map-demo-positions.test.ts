import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Carte du portail : sans ce pas de simulation, les positions démo vieillissaient au-delà du seuil
// (45 s) quand personne ne regardait la carte du back-office, et devenaient « périmées » (masquées).
test("la carte du portail fait avancer les positions démo avant de les lire, comme le dispatch", () => {
  for (const file of ["src/app/api/portal/deliveries/map/route.ts", "src/app/api/dispatch/map/route.ts"]) {
    const source = readFileSync(file, "utf8");
    const advance = source.indexOf("advanceDemoDriverPositions(companyId)");
    assert.ok(advance > 0, `${file} : appel absent`);
    const read = source.indexOf(file.includes("portal") ? "getClientDeliveriesMap(" : "getDispatchMapDeliveries(", advance);
    assert.ok(read > advance, `${file} : la lecture doit suivre le pas de simulation`);
  }
});
