// LOT1-D9 — une liste ne précharge pas chaque fiche : sur téléphone, chaque préchargement passait par le
// serveur et la base (droits relus par le middleware), deux fois par ligne, pendant que la page chargeait
// ses données (mesure du 14 novembre 2026 dans l'application Android : 24 requêtes pour la liste des clients).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROW_LINKS: Array<[string, string]> = [
  ["src/app/(back-office)/companies/page.tsx", "href={`/companies/${row.id}`}"],
  ["src/features/invoices/admin-invoice-detail.tsx", "href={`/dashboard/orders/${order.id}`}"],
  ["src/features/invoices/admin-invoices-content.tsx", "href={`/dashboard/invoices/${invoice.id}`}"],
  ["src/features/invoices/admin-invoices-content.tsx", "href={gap.href}"],
  ["src/features/invoices/generate-invoices-dialog.tsx", "href={`/dashboard/invoices/${invoice.id}`}"],
  ["src/features/merchants/merchants-content.tsx", "href={`/dashboard/merchants/${row.id}`}"],
  ["src/features/ordering/order-card.tsx", "href={`/portal/orders/${order.id}`}"],
  ["src/features/orders/admin-orders-content.tsx", "href={`/dashboard/orders/${order.id}`}"],
];

test("LOT1-D9 : les liens de lignes de liste ne préchargent pas leur fiche", () => {
  for (const [file, href] of ROW_LINKS) {
    const line = readFileSync(file, "utf8").split("\n").find((text) => text.includes(`<Link ${href}`));
    assert.ok(line, `${file} : lien ${href} introuvable`);
    assert.match(line!, /prefetch=\{false\}/, `${file} : ${href} doit porter prefetch={false}`);
  }
});
