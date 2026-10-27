import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const classes = new Set(["directe", "indirecte", "plateforme", "partagée", "technique"]);
const exports = new Set(["oui", "non", "partiel"]);

function read(path: string) {
  return readFileSync(fileURLToPath(new URL(path, root)), "utf8");
}

test("chaque modèle Prisma est classé et l'inventaire ne décide aucune conservation", () => {
  const schema = read("prisma/schema.prisma");
  const inventory = read("docs/operations/data02/INVENTORY.md");
  const models = [...schema.matchAll(/^model (\w+) /gm)].map((match) => match[1]).filter((name): name is string => Boolean(name));
  const rows = inventory
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Modèle") && !line.startsWith("| ---"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter(Boolean));
  const classified = rows.map((row) => row[0]).filter((name): name is string => Boolean(name));
  assert.deepEqual([...classified].sort(), [...models].sort());
  for (const row of rows) {
    assert.equal(classes.has(row[1] ?? ""), true, row[0]);
    assert.equal((row[2] ?? "").length > 0, true, row[0]);
    assert.equal(exports.has(row[3] ?? ""), true, row[0]);
  }
  assert.match(inventory, /Auth et Storage ne sont pas lus/);
  assert.match(inventory, /Aucune durée de conservation n'est choisie/);
  assert.match(inventory, /exportCompanyData/);
  assert.match(read("TODO.md"), /^- \[ \] \*\*DATA-02/m);
});
