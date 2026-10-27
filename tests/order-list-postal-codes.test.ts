import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// « Aucun compatible » : la liste des commandes ne transmettait aucun code postal au sélecteur de
// chauffeur (company-order-columns lit delivery.postalCode ?? row.shippingPostalCode, et le pickup).
test("la liste des commandes sélectionne les codes postaux lus par le sélecteur de chauffeur", () => {
  const source = readFileSync("src/domains/order/order.service.ts", "utf8");
  const start = source.indexOf("const COMPANY_ORDER_HISTORY_SELECT");
  const select = source.slice(start, source.indexOf("} satisfies Prisma.OrderSelect;", start));
  for (const field of ["shippingPostalCode", "pickupPostalCode"]) {
    assert.match(select, new RegExp(`^  ${field}: true,`, "m"), field);
  }
  const deliveries = select.slice(select.indexOf("deliveries:"));
  for (const field of ["postalCode", "pickupPostalCode"]) {
    assert.match(deliveries, new RegExp(`^      ${field}: true,`, "m"), `deliveries.${field}`);
  }
  const columns = readFileSync("src/features/back-office/company-order-columns.tsx", "utf8");
  assert.match(columns, /postalCode=\{delivery\.postalCode \?\? row\.shippingPostalCode\}/);
  assert.match(columns, /pickupPostalCode=\{delivery\.pickupPostalCode \?\? row\.pickupPostalCode\}/);
});
