import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("UX-03 : les entrées du back-office vers une livraison ouvrent sa fiche, pas la commande", () => {
  assert.match(read("src/features/back-office/dispatch-columns.tsx"), /href=\{`\/dashboard\/deliveries\/\$\{row\.id\}`\}/);
  const map = read("src/features/back-office/dispatch-unified-map.tsx");
  assert.match(map, /router\.push\(`\/dashboard\/deliveries\/\$\{id\}`\)/);
  assert.doesNotMatch(map, /\/dashboard\/orders\//);
  assert.match(read("src/app/(back-office)/support/page.tsx"), /href=\{`\/dashboard\/deliveries\/\$\{ticket\.relatedDelivery\.id\}`\}/);
});

test("UX-03 : la fiche lit la livraison filtrée par entreprise et relègue la commande en informations techniques", () => {
  const page = read("src/app/(back-office)/dashboard/deliveries/[id]/page.tsx");
  assert.match(page, /useCompanyDelivery\(id \?\? ""\)/);
  assert.match(page, /<h1[^>]*>\{delivery\.reference\}<\/h1>/);
  assert.doesNotMatch(page, /<h1[^>]*>\{order\.reference\}/);
  assert.match(page, /data-delivery-technical="true"/);
  const route = read("src/app/api/deliveries/[id]/route.ts");
  assert.match(route, /requireRole\(auth\.context, \["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"\]\)/);
  assert.match(route, /getCompanyDeliveryById\(companyId, id\)/);
  assert.match(read("src/domains/delivery/delivery.service.ts"), /where: \{ id: deliveryId, companyId \}/);
});

test("UX-03 : la liste du tableau de bord ouvre la fiche livraison", () => {
  assert.match(read("src/features/back-office/dashboard-delivery-list-dialog.tsx"), /href=\{`\/dashboard\/deliveries\/\$\{encodeURIComponent\(delivery\.id\)\}`\}/);
});

test("UX-03 : client et livreur reçoivent échéance et retard de la même règle, sans la consigne interne", () => {
  for (const path of ["src/app/api/portal/deliveries/[id]/route.ts", "src/app/api/driver/missions/route.ts"]) {
    const route = read(path);
    assert.match(route, /const \{ dueAt, late, lateByMinutes \} = deliveryTiming\(/, path);
    assert.doesNotMatch(route, /nextAction/, path);
  }
  assert.match(read("src/features/driver/mission-card.tsx"), /data-mission-due="true"/);
  assert.match(read("src/app/(client-portal)/portal/deliveries/[id]/page.tsx"), /data-delivery-due="true"/);
});
