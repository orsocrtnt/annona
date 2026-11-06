import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// FIABILITE / SCHEMA-1 : chaque clé étrangère de la migration initiale est servie par un index
// (ou la clé primaire) dont elle est la première colonne. Sans cet index, une suppression en
// cascade ou une jointure parcourt toute la table enfant.
const sql = readFileSync(resolve("prisma/migrations/20261106200000_init/migration.sql"), "utf8");

const columns = (list: string) => [...list.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]!);

const foreignKeys = [...sql.matchAll(/ALTER TABLE "([a-z_]+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \(([^)]*)\) REFERENCES "([a-z_]+)"/g)].map(
  (match) => ({ table: match[1]!, columns: columns(match[2]!), references: match[3]! })
);

/** Colonnes de tête de chaque index, contrainte unique ou clé primaire, par table. */
const leading = new Map<string, string[][]>();
function add(table: string, cols: string[]) {
  leading.set(table, [...(leading.get(table) ?? []), cols]);
}
for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([a-z_]+)"\(([^)]*)\)/g)) add(match[1]!, columns(match[2]!));
for (const match of sql.matchAll(/CREATE TABLE "([a-z_]+)" \(([\s\S]*?)\n\);/g)) {
  const pk = /CONSTRAINT "[^"]+" PRIMARY KEY \(([^)]*)\)/.exec(match[2]!);
  if (pk) add(match[1]!, columns(pk[1]!));
}

test("la migration initiale déclare des clés étrangères (lecture du SQL)", () => {
  assert.ok(foreignKeys.length >= 40, `clés étrangères trouvées : ${foreignKeys.length}`);
});

test("chaque clé étrangère est la tête d'un index ou de la clé primaire de sa table", () => {
  const missing = foreignKeys.filter(({ table, columns: fk }) =>
    !(leading.get(table) ?? []).some((index) => fk.every((column, position) => index[position] === column))
  );
  assert.deepEqual(missing.map(({ table, columns: fk }) => `${table}(${fk.join(", ")})`), []);
});

test("chaque table rattachée à une entreprise a sa clé étrangère vers companies et un index en tête company_id", () => {
  const tablesWithCompany = [...sql.matchAll(/CREATE TABLE "([a-z_]+)" \(([\s\S]*?)\n\);/g)]
    .filter((match) => /\n\s+"company_id" TEXT/.test(match[2]!))
    .map((match) => match[1]!);
  assert.ok(tablesWithCompany.length >= 24, `tables avec company_id : ${tablesWithCompany.length}`);
  for (const table of tablesWithCompany) {
    assert.ok(
      foreignKeys.some((fk) => fk.table === table && fk.columns.join() === "company_id" && fk.references === "companies"),
      `${table} : clé étrangère company_id → companies`
    );
    assert.ok((leading.get(table) ?? []).some((index) => index[0] === "company_id"), `${table} : index en tête company_id`);
  }
});
