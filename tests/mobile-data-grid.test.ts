import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataGrid } from "../src/components/ui/data-grid";
import { DataGridCards } from "../src/components/ui/data-grid-cards";
import { dataGridVariant, MOBILE_CARDS_QUERY, splitCardColumns } from "../src/lib/table/mobile-cards";
import type { TableColumn } from "../src/types";

type Row = { id: string; name: string; city: string; phone: string };

const columns: TableColumn<Row>[] = [
  { key: "name", header: "Nom", sortable: true },
  { key: "city", header: "Ville" },
  { key: "phone", header: "Téléphone", hideOnMobile: true },
  { key: "actions", header: "", cell: (row) => React.createElement("button", { type: "button" }, `Ouvrir ${row.id}`) },
];

const rows: Row[] = [
  { id: "a", name: "Alice", city: "Lyon", phone: "0102030405" },
  { id: "b", name: "N".repeat(60), city: "Nice", phone: "0607080910" },
];

test("splitCardColumns : titre, champs et actions, hideOnMobile masqué comme dans le tableau mobile", () => {
  const { title, fields, actions } = splitCardColumns(columns);
  assert.equal(title?.key, "name");
  assert.deepEqual(fields.map((c) => c.key), ["city"]);
  assert.deepEqual(actions.map((c) => c.key), ["actions"]);
});

test("splitCardColumns : aucune colonne avec en-tête, tout en actions", () => {
  const layout = splitCardColumns<Row>([{ key: "actions", header: " " }]);
  assert.equal(layout.title, null);
  assert.deepEqual(layout.fields, []);
  assert.equal(layout.actions.length, 1);
});

test("dataGridVariant et requête : cartes sous 768 px, tableau au-delà", () => {
  assert.equal(dataGridVariant(true), "cards");
  assert.equal(dataGridVariant(false), "table");
  assert.equal(MOBILE_CARDS_QUERY, "(max-width: 767px)");
});

test("DataGridCards : une carte par ligne, colonnes hideOnMobile masquées comme dans le tableau mobile", () => {
  const html = renderToStaticMarkup(React.createElement(DataGridCards<Row>, { rows, columns, getRowId: (r: Row) => r.id }));
  assert.equal(html.match(/<li /g)?.length, 2);
  assert.match(html, /data-testid="data-grid-cards"/);
  assert.doesNotMatch(html, /Téléphone/);
  assert.doesNotMatch(html, /0607080910/);
  assert.match(html, /Lyon/);
  assert.match(html, /Ouvrir a/);
  assert.match(html, /N{60}/);
  assert.doesNotMatch(html, /<table/);
});

test("DataGridCards : liste vide et ligne surlignée", () => {
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(DataGridCards<Row>, { rows: [], columns })), /<li /);
  const html = renderToStaticMarkup(
    React.createElement(DataGridCards<Row>, { rows, columns, getRowId: (r: Row) => r.id, highlightedRowId: "b", highlightedRowLabel: "Ciblé" })
  );
  assert.equal(html.match(/data-highlighted="true"/g)?.length, 1);
  assert.match(html, /aria-label="Ciblé"/);
});

test("DataGrid : le rendu serveur reste le tableau (ordinateur inchangé)", () => {
  const html = renderToStaticMarkup(React.createElement(DataGrid<Row>, { data: rows, columns }));
  assert.match(html, /<table/);
  assert.doesNotMatch(html, /data-testid="data-grid-cards"/);
});
